# Account deletion — design

## Purpose

Make "Delete my account and everything in it" true. Today that control in Settings is wired to `signOut` (`apps/web/src/pages/Settings.tsx:117`) and deletes nothing. This specifies real, irreversible deletion of a user's app data, their stored media, and their auth identity.

Companion to [`2026-08-13-dashboard-fixes-design.md`](./2026-08-13-dashboard-fixes-design.md), which covers the account menu and the plain sign-out row. That spec declared real deletion out of scope; this supersedes that decision.

## Confirmed decisions

- **Full deletion**, including the Supabase auth identity — not data-only.
- **R2 cleanup is fixed for the existing single-recording delete too**, not just for account deletion.

## New infrastructure required (blocking, manual)

Deleting the Supabase `auth.users` row requires the admin API, which requires a service role key. The server does not have one:

- `apps/server/.env.example` has only `SUPABASE_URL` under `# Supabase (Auth)`.
- No `SERVICE_ROLE` / `auth.admin` / `createClient` reference exists anywhere in `apps/server/src`.
- `@supabase/supabase-js` is already a dependency (`apps/server/package.json:41`) but is never imported — auth is JWKS verify-only (`apps/server/src/auth/jwt.strategy.ts:18`).

So **`SUPABASE_SERVICE_ROLE_KEY` must be provisioned into the Cloud Run service environment** before this ships. This cannot be done from the repo. `CLAUDE.md` states the server has "no service key"; that line must be updated, because this change makes it false.

The key is a full-privilege credential that bypasses row-level security. It is read from env only, never logged, never sent to a client, and used solely by the deletion path.

## Why a tombstone is required

Supabase access tokens are stateless ES256 JWTs verified against JWKS. Deleting the auth user does **not** invalidate tokens already issued — they keep verifying until `exp`. And `POST /users/sync` (`apps/server/src/users/users.controller.ts:10`) calls `findOrCreateBySupabaseId`, which lazily creates a `sr_users` row for any valid token.

Therefore, without further protection, a deleted user's still-live token would **recreate their row** on the next request. This is the sharpest hazard in the whole feature.

Mitigation: a tombstone table recording deleted `supabaseId`s. `findOrCreateBySupabaseId` refuses to create a row for a tombstoned id.

This does not lock the person out permanently. `supabaseId` is the `auth.users.id` UUID; once that row is deleted, signing in with the same Google account provisions a **brand-new** auth user with a **new** UUID. So a tombstone on the old id blocks only stale tokens and never blocks a legitimate return. No TTL or expiry logic is needed, and none should be added.

## Server design

### Route

`DELETE /users/me` on `UsersController`, guarded by `JwtAuthGuard`. It takes no body and no id — the subject comes from the verified token, so one user can never delete another. Returns `{ success: true }`.

Note `req.user.id` is the Supabase `sub`, not `sr_users.id` (set at `apps/server/src/auth/jwt.strategy.ts:41`) — the same convention the recordings delete already follows.

### `UsersService.deleteAccount(supabaseId)`

Ordering is deliberate. Media keys must be collected before rows are deleted, DB work must be atomic, and the auth identity must go last so a failure there leaves the user able to sign in rather than leaving orphaned unreachable data.

1. Look up the user by `supabaseId`. If absent, `NotFoundException`.
2. Collect the R2 keys of every recording owned by the user. `Recording.fileUrl` **is** the R2 key — the wipe script uses it directly as `Key` (`apps/server/scripts/wipe-recordings.ts:70-72`). `thumbnailUrl` is never written by anything (see the note at `apps/web/src/lib/captureAdapter.ts:37-40`), so there are no thumbnail objects to collect; do not invent a second key.
3. In a **single transaction**:
   - Delete the user's own `sr_reactions` and `sr_comments` rows. These are their contributions on *other people's* recordings, and their FKs are `ON DELETE NO ACTION`, so they must go explicitly or the user delete throws `23503`.
   - Delete the user's `sr_recordings`. DB-level `ON DELETE CASCADE` then clears reactions, comments, views, and video projects attached to those recordings.
   - Insert the tombstone row.
   - Delete the `sr_users` row.
4. Delete the collected R2 objects via `StorageService.deleteObject` (`apps/server/src/storage/storage.service.ts:102`, which already exists and currently has zero callers). Best-effort: a failed object delete is logged and counted but does not fail the request. The user's right to have their account removed outweighs a leaked file, and the DB transaction has already committed.
5. Delete the Supabase auth user via the admin client. Failure here is logged and surfaced as a non-fatal warning in the response — the app data is already gone, and the tombstone prevents resurrection, so the outcome is acceptable rather than corrupt.

Deliberately **not** changed: `sr_comments.resolvedByUserId` is a bare uuid column with no FK by design (`apps/server/src/recordings/entities/comment.entity.ts:44-47` documents that attribution is simply lost). It is left dangling.

Deliberately **not** changed: the `ON DELETE` behavior of the existing `sr_recordings`, `sr_reactions`, and `sr_comments` user FKs. Deleting those rows explicitly avoids touching constraints that no migration defines — the `sr_recordings.userId` FK predates the migration set (created when `synchronize` was still on, now `synchronize: false` at `apps/server/src/app.module.ts:36`), so its live definition is unverified and altering it blind is riskier than deleting rows in order.

### Tombstone entity

A new `sr_deleted_accounts` table: `supabaseId` (unique, the blocked id) and `deletedAt`. Registered in **both** `app.module.ts` and `data-source.ts` — the project requires entities in both places — and created by a generated migration. `synchronize` is false, so a migration is mandatory and no applied migration may be edited.

`findOrCreateBySupabaseId` (`apps/server/src/users/users.service.ts:22`) gains a tombstone check before its create branch, throwing `ForbiddenException` for a tombstoned id. Its existing `23505` race handling is unchanged.

### Supabase admin client

A small, focused provider wrapping `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })` and exposing one method, `deleteUser(supabaseId)`. It is the only place the service key is read. If the key is absent the provider must fail loudly at startup rather than silently degrading to a no-op that would make deletion quietly incomplete.

## R2 leak fix (independent of deletion)

`RecordingsService.delete` (`apps/server/src/recordings/recordings.service.ts:410-426`) ends at `repository.remove` and never touches storage — `RecordingsService` does not even inject `StorageService`. Every recording ever deleted has orphaned its R2 object permanently.

Fix: inject `StorageService` into `RecordingsService` and delete the object after the row, best-effort with a logged failure. The existing ownership check (lines 411-422) and its `ForbiddenException`/`NotFoundException` behavior are unchanged.

This is a standalone improvement and should be a separate commit from the deletion feature.

## Web design

### Settings

The `deleteAccount` field (`apps/web/src/pages/Settings/sections.ts:110-118`) becomes a real destructive action rather than a mislabelled sign-out. It keeps its `destructive: true` treatment, its label, and its "This cannot be undone" help text — all now accurate.

Because it is irreversible, it requires explicit confirmation rather than a single click: a confirmation step in which the user types their own email address to enable the confirm button. Typing a fixed word like DELETE is weaker — the email is specific to the account being destroyed, which prevents confirming the wrong account.

Confirmation UI reuses existing components rather than a new modal system: `BottomSheet` on mobile and the established dialog treatment on desktop, with the destructive control using coral, which is legitimate here — coral is reserved for live capture and needs-a-response, and an irreversible destructive confirmation is the latter.

On success the client calls `signOut()` and lands on the login page. On failure it surfaces the error inline and does **not** sign out, so the user can see what happened.

The plain **Sign out** row specified in the companion doc still exists, separately from this. Sign out and delete must not be the same control — that confusion is the bug being fixed.

### Data layer

A `deleteAccount` mutation alongside the other calls in `apps/web/src/hooks/useRecordings.ts`, using the existing `fetchWithAuth` (which attaches the Supabase access token). On success it clears the TanStack Query cache, since every cached recording belongs to an account that no longer exists.

`signOut` currently leaves `guestId`, `guestRecordingIds`, and `auth_return_path` in localStorage. For a deleted account those must be cleared too, otherwise a subsequent guest session inherits identifiers tied to destroyed data. This is a narrow, deletion-specific cleanup; the general `signOut` behavior stays as it is.

## Testing strategy

Server (Jest, `apps/server`):

- `deleteAccount` removes recordings, the user's own reactions and comments, and the user row; inserts a tombstone; and calls `StorageService.deleteObject` once per recording key.
- A failing `deleteObject` still results in a successful deletion (best-effort), and the failure is logged.
- A failing Supabase admin delete still results in committed DB deletion.
- `findOrCreateBySupabaseId` throws for a tombstoned id and does **not** create a row — the resurrection regression test, and the most important test in this spec.
- `DELETE /users/me` requires a token, and deletes only the token's own subject.
- `RecordingsService.delete` calls `deleteObject` with the recording's `fileUrl`, and still enforces ownership.

Web (Vitest + RTL, `apps/web`):

- The confirm button is disabled until the typed email matches exactly.
- Confirming calls the mutation, then `signOut`.
- A failed request shows an error and does not sign out.
- Settings no longer wires sign-out to the delete control, and a distinct sign-out row exists.

Manual verification is required and cannot be skipped, because the destructive path cannot be fully exercised in tests: on a throwaway account, delete it and confirm the recordings are gone from the DB, the objects are gone from the R2 bucket, the auth user is gone from the Supabase dashboard, and that reusing the pre-deletion access token against `POST /users/sync` does **not** recreate a row.

## Acceptance criteria

- Deleting an account removes its recordings, its comments and reactions, its video projects, its R2 objects, its `sr_users` row, and its Supabase auth identity.
- A still-valid token from before deletion cannot recreate the account.
- Signing in again with the same Google account yields a fresh, empty account.
- Deletion requires typed email confirmation and is reachable only by the account's own owner.
- Deleting a single recording removes its R2 object.
- No control conflates sign-out with deletion.

## Out of scope

- Data export before deletion.
- A soft-delete or restore window.
- Deleting the user's comments from *other* users' recordings via an anonymize-instead-of-delete path; they are deleted.
- Retroactive cleanup of R2 objects already orphaned by past deletes. A one-off reconciliation script would be a separate piece of work.
- Backfilling or normalizing the unmigrated `sr_recordings.userId` FK definition.
