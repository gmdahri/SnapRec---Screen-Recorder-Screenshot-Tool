# Two-Provider Email: Resend for Transactional, Loops for Bulk

**Date:** 2026-08-18
**Status:** Approved design, pending implementation plan

## Decision

Keep Resend as the transactional/onboarding sender. Add Loops.so as the sender for
bulk promotional email. This is an addition, not a replacement — both providers stay.

The split is by use case:

| Use case | Provider | Content lives in |
|---|---|---|
| Welcome email on signup | Resend | `src/mail/templates/welcome.ts` |
| Founder welcome (auto + backfill) | Resend | `src/mail/templates/founder-welcome.ts` |
| Bulk promotions, launches, asks | Loops | Loops campaign editor |

## Why Loops is not a drop-in swap

Resend accepts raw HTML. Loops does not. Its transactional endpoint takes a
`transactionalId` referencing a template stored in Loops plus `dataVariables`; the
Content API can create templates programmatically but the body must be **LMX**
(Loops' own markup: `Paragraph`, `H1`, `Button`, `Image`, `Columns`, `Section`,
`Style`). There is no raw-HTML block and MJML is rejected with a 409. Payload cap
is 100KB per message.

Consequence: the existing bulk HTML templates cannot be ported. Bulk copy is
authored in the Loops editor instead, which was an explicit decision — it trades
git history for the editor's built-in unsubscribe, suppression and audience
handling.

## Scope

### Moves to Loops (deleted from this repo)

- `src/scripts/send-patreon-support.ts`
- `src/scripts/send-auto-zoom-launch.ts`
- `src/scripts/send-video-editor-launch.ts`
- `src/mail/templates/patreon-support.ts`
- `src/mail/templates/auto-zoom-launch.ts`
- `src/mail/templates/video-editor-launch.ts`
- The six `script:email-*` entries in `apps/server/package.json`

Their copy is preserved in git history. The Loops editor becomes the source of
truth for bulk content.

### Stays on Resend (unchanged)

- `src/mail/mail.service.ts` — `sendWelcomeEmail`, `sendFounderWelcomeEmail`
- `src/mail/templates/welcome.ts`, `src/mail/templates/founder-welcome.ts`
- `src/scripts/send-founder-welcome.ts` — bulk *delivery* of onboarding content;
  stays on Resend by decision
- `src/scripts/send-welcome-to-specific.ts` — hardcoded `TARGET_EMAILS`

### The repo's new job

The repo no longer sends bulk email. It keeps the Loops audience accurate so
campaigns can be composed and sent from the Loops dashboard against the
"Snaprec Loops List" mailing list.

## Loops-side setup (dashboard, outside this repo)

1. **API key** — Settings → API. Stored as `LOOPS_API_KEY` in `apps/server/.env`.
   Verify with `GET /v1/api-key`.
2. **Mailing list** — "Snaprec Loops List", `isPublic: true` so contacts can
   self-manage from the hosted preferences page. Stored as
   `LOOPS_MAILING_LIST_ID`.
3. **Sending domain** — bulk sends go from the **root domain**
   (`snaprecorder.org`), by decision. Verified state as of 2026-08-18:

   | Record | Owner |
   |---|---|
   | `snaprecorder.org` MX → `route{1,2,3}.mx.cloudflare.net` | Cloudflare Email Routing (receiving) — untouched |
   | `send.snaprecorder.org` MX/SPF → SES eu-west-1 | Resend envelope |
   | `envelope.snaprecorder.org` MX/SPF → SES us-east-1 | Loops envelope |
   | `_dmarc.snaprecorder.org` | `v=DMARC1; p=none;` — no `rua=` |

   Each provider keeps its MX and SPF on its own envelope subdomain, so the root
   MX is untouched and `founder@snaprecorder.org` still receives replies. SPF is
   evaluated against the envelope domain and DKIM signs as `snaprecorder.org`, so
   DMARC passes under relaxed alignment for both senders. No collision.

   **Accepted tradeoff:** both providers send `From: …@snaprecorder.org`, and
   inbox providers key reputation largely on the From/DKIM `d=` domain. Promotional
   complaint signals therefore touch the same domain reputation that delivers
   welcome mail. Moving bulk to a dedicated subdomain remains available if
   transactional engagement degrades.

   **Recommended, not blocking:** add `rua=mailto:…` to the DMARC record. With
   `p=none` and no reporting address there is no visibility into alignment
   failures, which matters more now that a second sender shares the domain.

   None of this blocks implementation — the code needs only the API key and list
   ID. The `from` address is configured per-campaign in Loops.

## Architecture

New `src/loops/` module, mirroring the structure of `src/mail/`:

- **`loops.contacts.ts`** — pure functions, no I/O:
  - `splitName(fullName)` → `{ firstName, lastName }`
  - `isExcludedEmail(email, domains)`
  - `buildContactPayload(user)`
  All rules live here so the service and the backfill script cannot drift apart.
- **`loops.service.ts`** — `@Injectable()` API wrapper. One public method:
  `upsertContact(user)`.
- **`loops.module.ts`** — provides and exports `LoopsService`.
- **`loops.contacts.spec.ts`** — unit tests; matches the existing Jest config
  (`rootDir=src`, `*.spec.ts`).

**Client:** plain `fetch` (Node 22 global), in `loops.client.ts` — a Nest-free
class so the backfill script can use it without bootstrapping the app. Chosen over
the official `loops` npm package because every HTTP contract was verified live
against the API, so the SDK would add an unverified layer plus a dependency for
four endpoints; injecting a `fetch` double also keeps the client unit-testable.

### Signup hook

`UsersModule` imports `LoopsModule`. `UsersService.findOrCreateBySupabaseId`
fires the contact upsert fire-and-forget immediately beside the existing welcome
email (`users.service.ts:40-42`), using the same shape:

```ts
this.loopsService.upsertContact(user)
    .catch(err => this.logger.error('Failed to sync Loops contact', err));
```

Nothing in the signup path awaits Loops. A Loops outage must never fail or slow
user creation.

### Backfill script

`src/scripts/sync-loops-contacts.ts`, following the conventions of the existing
scripts: its own `DataSource`, `dotenv` config, no Nest bootstrap. It imports the
pure logic from `loops.contacts.ts`.

Registered as `script:sync-loops-contacts` (plus a `:dry` variant) in
`package.json`.

## Field mapping

| Loops field | Source |
|---|---|
| `email` | `user.email`, lowercased |
| `firstName` / `lastName` | `user.fullName` split on first space |
| `userId` | `user.supabaseId` (nullable), falling back to `user.id` (always present) |
| `source` | `"snaprec-app"` |
| `signedUpDate` (custom, date) | `user.createdAt` as ms timestamp |
| `subscribed` | **never sent** |
| `mailingLists` | **only on create** |

A probe on 2026-08-18 auto-created a property named `signedUpAt` typed
`number` (Loops infers the type from the first value sent). Loops cannot retype a
property and exposes no delete-property endpoint, so the sync uses a deliberately
created `signedUpDate` of type `date` instead. Create it explicitly with
`POST /v1/contacts/properties` before the first sync — never let a custom property
auto-create.

### The opt-out rule (critical)

Loops documents that `subscribed: true` **resubscribes** a contact who has opted
out, and recommends omitting the field unless deliberately changing status.
Re-asserting `mailingLists` on an update can likewise re-add someone who left the
list.

Therefore the upsert is:

1. `POST /v1/contacts/create` including `mailingLists`.
2. If the response indicates the contact already exists, retry as
   `PUT /v1/contacts/update` with the name and `userId` fields **only** — no
   `subscribed`, no `mailingLists`.

One API call in the common case, and an opt-out is never silently overwritten.

**Open item for implementation:** the exact response shape for a duplicate
`create` must be verified against the live API rather than inferred from the docs,
since the branch depends on it.

## Safety rails

- **`LOOPS_MIN_CONTACTS`** (default 10) — the backfill aborts below this
  threshold, mirroring `MIN_RECIPIENTS` in the deleted `send-patreon-support.ts`.
  The local `.env` points at a 2-user dev Supabase project, so this *will* trip on
  a first local run; override with `LOOPS_MIN_CONTACTS=1` after confirming which
  database is targeted.
- **`DRY_RUN=1`** — prints mapped payloads, makes no API calls.
- **`EXCLUDED_DOMAINS`** (default `codingcops.com`) — applied at sync time, so
  internal addresses never enter the Loops audience at all. Matches subdomains
  (`endsWith('.' + domain)`).
- **Dedupe** by lowercased email before sending, so duplicate user rows produce
  one contact.
- **Rate limiting** — stay under Loops' 10 req/s standard limit; exponential
  backoff on 429.
- **Summary output** — created / updated / skipped / failed counts.

## Testing

- Unit tests in `loops.contacts.spec.ts` for `splitName` (single name, empty,
  extra whitespace, multi-word surnames), `isExcludedEmail` (exact match,
  subdomain match, case), and `buildContactPayload` (asserting `subscribed` is
  absent and `mailingLists` appears only in the create payload).
- The opt-out rule gets an explicit test — it is the highest-consequence logic
  here.
- Manual verification: `DRY_RUN=1` run, then a live run against the dev DB with
  `LOOPS_MIN_CONTACTS=1`, confirming contacts land in the Loops audience with the
  expected properties and list membership.

## Documentation and config updates

- `apps/server/.env.example` — add `LOOPS_API_KEY`, `LOOPS_MAILING_LIST_ID`,
  `LOOPS_MIN_CONTACTS` (placeholder values only). `RESEND_*` stays.
- `CLAUDE.md` — update the `mail/` description to record that Resend is
  transactional-only and Loops owns bulk, and that bulk copy lives in the Loops
  editor rather than the repo.

## Out of scope

- **Event-driven lifecycle automation** — emitting `POST /v1/events/send` on real
  user actions (first recording, project created) to drive Loops workflows. This
  is the strongest long-term reason to own Loops, but it is a separate project.
- **Migrating transactional email to Loops.** Resend keeps it.
- **Sending campaigns via the Content API.** Campaigns are composed and sent from
  the dashboard.

## Deliverability note

The deleted `send-patreon-support.ts` defaulted to `EMAIL_STYLE=plain` because
Gmail files branded HTML under Promotions, where a donation ask goes unread. Loops
campaigns add tracking pixels, link rewriting and a hosted unsubscribe footer by
default, which pushes harder toward Promotions rather than away. For promotional
sends that is an acceptable trade — Promotions is the correct tab for them. It is
recorded here so the tradeoff is not rediscovered later, and it is a reason not to
move founder-prose mail to Loops.
