# Security backlog: recordings write path

Findings from the adversarial review of `fix/recordings-insert-only` that were **not** fixed in this release. Each lists its severity, why it's deferred, the proposed fix, what clients would have to change, and the failing tests that already pin it down.

Fixed in this release, for reference:

| Finding | Commit |
|---|---|
| #1 guest ids leaking from responses | `bc9eaca` |
| #2 lost updates on recordings rows | `bd0f214` |
| #3 anonymous reaction toggling another user's | `86e73b0` |
| #4 claiming guest rows that have no guest id | `9e5a2cf` |
| #7 existence check failing open | `2929a06` |

**Where the failing tests are.** Branch `worktree-agent-ad760417980069725` (worktree `.claude/worktrees/agent-ad760417980069725`), commit `3a803e7`, under `apps/server/src/recordings/__tests__/review/`. They were written against `3e9a754`, and on 2026-10-10 I re-ran them against the current release head `282a90b`. The ones listed below still fail for the stated reason. They are deliberately kept off the release branch so that branch stays green; move each one over together with its fix.

| # | Severity | Status |
|---|---|---|
| 5 | Medium / Low | Deferred; needs client changes |
| 6 | Low | Deferred; same root cause as #5 |
| 8 | Low | Deferred; needs a data check before the migration |
| 9 | Low | Deferred; correctness, not security |

---

## #5: a presigned PUT can overwrite a file that appears after signing

**Severity: Medium / Low.** `POST /recordings/upload-url` refuses a key that already holds a file (`08a1a71`), but only when the URL is **signed**. The URL then stays valid for an hour and signs only `host`, with no condition on the object. A URL obtained while a key is empty still overwrites the file that lands there later.

To use this, an attacker has to sign the exact key **before** its owner uploads to it. The web's keys are predictable apart from a millisecond timestamp:

| Caller | Key |
|---|---|
| `useEditorLifecycle.ts:80` | `update-<recordingId>-<ms>.png`, `screenshot-<ms>.png` |
| `VideoEditorContext.tsx:770` | `publish-<recordingId>-<ms>.<ext>` |
| `VideoEditorContext.tsx:848` | `export-<projectId>-<ms>.<ext>` |
| `ShareView.tsx:674` | `video-<id>-<ms>.webm` |

The recording id comes from the share link. The timestamp means covering every millisecond of the window in which the owner might act, about a thousand signed URLs per second of window per target. `upload-url` is anonymous and not rate-limited, so that's expensive but possible. Extension keys contain a random UUID and aren't exposed to this.

**Why deferred.** No exploit has been shown end to end (the test only checks what the URL signs). A real fix changes what clients send. Simply adding a signed `If-None-Match` header would make every PUT from a client that doesn't send that header fail its signature check, including every shipped extension (`storage.js` uploads through `upload-url`).

**Proposed fix**, in two steps:

1. **The server chooses keys.** `upload-url` and `upload/begin` return a key made of a fixed prefix by kind plus a server-generated random UUID (`rec/<uuid>.webm`, `img/<uuid>.png`). The client's `fileName` is used only for its extension. This removes predictability, which is the precondition for both #5 and #6.
   - **Web:** all four callers above already register the **returned** `fileUrl`, so nothing changes.
   - **Extension:** `uploadQueuedCapture` and `uploadToR2` in `background/storage.js` register the name they *sent*, and the streaming upload uses its own name for parts and completion, since `upload/begin` returns only `uploadId`. So `upload/begin` must also return the key, and the extension must use it everywhere.
   - **Rollout:** the server starts returning the key while still honouring the client's name. Once Chrome Web Store telemetry shows versions below the one that uses returned keys are negligible, the server stops honouring client names.
2. **Optional, after step 1:** shorten the presigned URL's lifetime from 3600 s to around 600 s, and sign `If-None-Match: *` once every client sends it. The web's `uploadFile` and the extension's XHR PUT would each add one header. **Check that R2 supports conditional `PutObject` with `If-None-Match` in a staging bucket before relying on it.** It doesn't apply to multipart part uploads.

**Existing failing test:** `upload-overwrite-bypass.spec.ts`, "cannot be used to replace an object that appears after signing (must sign If-None-Match)". It currently fails because the signed headers are `["host"]`. If the fix is step 1 alone, rewrite this test to assert an unpredictable server-chosen key, since its current assertion is specific to the `If-None-Match` approach.

---

## #6: squatting a predictable key before its owner registers it

**Severity: Low.** The rule that the first recording to register a key owns it (`e21135a`) is decided by whoever calls `POST /recordings` first, not by who uploaded the file. `create()` checks neither that the key holds a file nor that the caller uploaded it. Every web flow uploads first and then registers, PATCHes or publishes, using the predictable keys from #5.

An attacker who registers `update-<victimId>-<ms>.png` as a guest first causes two things:
- the owner's `PATCH` or publish gets **409**;
- about an hour later, the sweep deletes the owner's new file, because the attacker's expired guest row is the only row pointing at it.

The deletion half predates `e21135a`; the 409 is new. Exploiting it needs the same millisecond guess as #5.

**Why deferred.** It has the same root cause as #5, client-chosen predictable keys, and the same fix removes it.

**Proposed fix.**
1. Server-chosen keys, as in #5 step 1. Without a predictable key there's nothing to squat.
2. Stronger, and independent of key format: **upload receipts.** `upload-url` and `upload/complete` return a short-lived signed receipt for the key: an HMAC over the key, the caller's identity (user id, or guest id) and an expiry. `POST /recordings`, `PATCH /recordings/:id` (with `fileUrl`), publish and the video editor's `newFileUrl` require a valid receipt for that key and that caller. That ties a key to the upload that created it.
   - **Client changes:** every caller passes the receipt along with `fileUrl`. That's four places in the web, plus `registerStreamedRecording`, `stream-upload.js`'s recovery, and `storage.js` in the extension.
   - Recovery after a crash would need the receipt saved alongside its other upload progress.
   - Roll out by accepting a missing receipt for a transition period, while logging how often it's missing.

**Existing failing test:** `key-squatting.spec.ts`, "owner PATCH of the key it just uploaded succeeds and the file survives the sweep". It currently fails with the owner's `PATCH` getting **409**.

---

## #8: two simultaneous registrations of the same key can both succeed

**Severity: Low.** `assertKeyAvailable` checks and then inserts, and there's no unique index on `"fileUrl"`. Under READ COMMITTED, two `POST /recordings` for one key can both pass the check before either inserts.

I couldn't reproduce this on a real local Postgres: four concurrent registrations gave one 201, three 409s, and one row. It needs a specific interleaving. The damage is also limited: since `e21135a`, the sweep never deletes a key another live row still uses.

**Why deferred.** A unique index is the real fix, but creating it fails if duplicates already exist. Production may have some, from before `e21135a` or from the attacks that release closed. Those need looking at first, which is a data decision rather than a code change.

**Proposed fix.**

1. **Check for duplicates**, read-only. This is query QA in `docs/security-incident-check.md`:

   ```sql
   BEGIN TRANSACTION READ ONLY;
   SELECT "fileUrl",
          count(*)                                    AS rows,
          array_agg(id ORDER BY "createdAt")          AS recording_ids,
          array_agg(CASE WHEN "userId" IS NULL THEN 'guest' ELSE 'user' END
                    ORDER BY "createdAt")             AS kinds
   FROM sr_recordings
   GROUP BY "fileUrl"
   HAVING count(*) > 1;
   ROLLBACK;
   ```

   Every row returned must be resolved before step 2, usually by deleting the later, illegitimate rows (planted guest rows). Do that with a reviewed one-off, not as part of the migration.

2. **Add the index** in a migration that runs **outside a transaction**. `CONCURRENTLY` can't run inside one; set `transaction = false` on the migration class.

   ```sql
   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "UQ_sr_recordings_fileUrl"
       ON sr_recordings ("fileUrl");
   ```

   If duplicates appeared between step 1 and step 2, `CONCURRENTLY` fails and leaves an **invalid** index behind. Check, and if needed drop and retry:

   ```sql
   SELECT indexrelid::regclass AS index, indisvalid
   FROM pg_index WHERE indexrelid = '"UQ_sr_recordings_fileUrl"'::regclass;
   -- if indisvalid = false:
   DROP INDEX CONCURRENTLY IF EXISTS "UQ_sr_recordings_fileUrl";
   ```

   Down migration: `DROP INDEX CONCURRENTLY IF EXISTS "UQ_sr_recordings_fileUrl";`

3. **Map the violation to 409** in `create`, `update` and `publish`. A `23505` whose constraint is `UQ_sr_recordings_fileUrl` becomes "This file belongs to another recording". Keep `assertKeyAvailable` for its clearer error in the common case. Note that `create()` already treats any `23505` as a race on the **id**, so it must tell the two constraints apart by `error.constraint`.

**Client changes:** none. Clients already handle a 409 on registration.

**Existing failing test:** `key-squatting.spec.ts`, "only one of two simultaneous registrations of the same fileUrl succeeds". It currently fails with `[201, 201]`. It models a database round trip with a 25 ms delay in the in-memory fake's `find()`; without that delay the fake runs the two requests one after the other and the test passes. With the index in place, keep the test and make the fake's `insert` enforce uniqueness on `fileUrl`, as Postgres will.

---

## #9: the video editor's `newFileUrl` can leave an edit half-applied

**Severity: Low** (correctness, not security). `VideoProjectsService.update` saves the project's title and timeline, and only then calls `RecordingsService.update` for `newFileUrl`. If that call is refused (409 from the key rule, 403, 404), the project has the new timeline but the recording still points at the old file. The web then reports a failure for an edit that was partly saved.

**Why deferred.** It isn't a security issue, the 409 that triggers it is rare in practice (it needs #6, or a reused key), and fixing it properly touches the video editor's save flow.

**Proposed fix.** Do both writes in one transaction (`dataSource.transaction(async (m) => { … })`, using the transaction's repositories for the project and the recording). Alternatively, run the recording update **first**, so a refused `newFileUrl` stops before the project changes. Either way, on a 409 the web's export flow (`VideoEditorContext.tsx`, around line 845) should say that the file couldn't be attached and keep the user's timeline, instead of a generic failure.

**Client changes:** only the clearer 409 message in the video editor. The request shape doesn't change.

**Existing failing tests: none.** The review raised this without a test. To add with the fix: a `PATCH /video-projects/:id` with a `newFileUrl` another recording holds should leave the project's `title` and `timelineJson` **unchanged** and return 409. Today it saves them and then fails.
