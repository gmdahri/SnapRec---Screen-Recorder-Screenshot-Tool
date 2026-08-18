# Loops Contact Sync for Bulk Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Loops.so audience in sync with the `sr_users` table so promotional campaigns can be composed and sent from the Loops dashboard, while Resend continues to handle all transactional email.

**Architecture:** A new `src/loops/` module with three layers — pure mapping rules (`loops.contacts.ts`), a Nest-free HTTP client (`loops.client.ts`), and a thin Nest wrapper (`loops.service.ts`). The service fires a fire-and-forget contact upsert on signup; a standalone backfill script reuses the same client and rules for existing users. The three bulk-email scripts and their HTML templates are deleted — Loops owns bulk content now.

**Tech Stack:** NestJS, TypeScript, TypeORM, Jest + ts-jest, Node 22 global `fetch` (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-18-loops-bulk-email-design.md`

## Global Constraints

- **Node 22.14** is the runtime (`node:22-alpine` in the Dockerfile). Global `fetch` is available; **add no new npm dependency** for this work.
- **Deviation from spec:** the spec named the official `loops` npm package. Use plain `fetch` instead. Every HTTP contract below was verified live against the Loops API, so the SDK adds an unverified layer and a dependency for four endpoints. Mocking `fetch` also keeps the client unit-testable.
- **Base URL:** `https://app.loops.so/api/v1`. **Auth:** `Authorization: Bearer <LOOPS_API_KEY>`.
- **Verified API contracts** (probed 2026-08-18, probe contacts created and deleted):
  - `POST /contacts/create` → `200 {"success":true,"id":"..."}`, or **`409 {"success":false,"message":"Email or userId is already in your audience."}`** when the email or userId already exists.
  - `PUT /contacts/update` → `200 {"success":true,"id":"..."}`. **Verified:** omitting `subscribed` preserves an existing `subscribed: false`.
  - `GET /contacts/find?email=<email>` → JSON array; `[]` when absent.
  - `POST /contacts/delete` → `{"success":true,"message":"Contact deleted"}`.
  - `POST /contacts/properties` `{"name","type"}` where type ∈ `string|number|boolean|date`. Unknown properties sent on a contact **auto-create as the inferred type**, and there is **no delete-property endpoint**.
- **Rate limit:** 10 requests/second per team. Back off on `429`.
- **THE OPT-OUT RULE — non-negotiable:** never send `subscribed` in any request, and send `mailingLists` **only** in a create. `subscribed: true` resubscribes someone who opted out; re-asserting `mailingLists` can re-add someone who left the list. Both create and update payload builders must be unit-tested to assert these keys are absent.
- **Internal addresses** (`EXCLUDED_DOMAINS`, default `codingcops.com`, subdomains included) must never reach the Loops API at all.
- **Existing env values** are already set in `apps/server/.env`: `LOOPS_API_KEY`, `LOOPS_MAILING_LIST_ID` (= `cmsyonpxf4krt0j2hha6s1akl`, "Snaprec Loops List"). Never commit real values; `.env.example` gets placeholders only.
- **Test layout:** domain modules keep tests in a `__tests__/` subfolder (see `src/recordings/__tests__/`). Jest config is `rootDir: src`, `testRegex: .*\.spec\.ts$`.
- Run all server commands from `apps/server`.

---

### Task 0: One-time Loops property setup

**Files:** none (dashboard/API setup only)

**Interfaces:**
- Consumes: nothing
- Produces: a `signedUpDate` contact property of type `date` in the Loops account, relied on by `buildCreatePayload` in Task 1.

- [ ] **Step 1: Create the date-typed property**

An earlier probe auto-created `signedUpAt` as type `number`. Loops cannot retype a property and offers no delete endpoint, so use a new, explicitly-typed name.

```bash
cd apps/server
source .env 2>/dev/null || export $(grep -E '^LOOPS_' .env | xargs)
curl -s -X POST https://app.loops.so/api/v1/contacts/properties \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"signedUpDate","type":"date"}'
```

Expected: `{"success":true}` (or a message saying it already exists — either is fine, this is idempotent in effect).

- [ ] **Step 2: Confirm the type is `date`**

```bash
curl -s "https://app.loops.so/api/v1/contacts/properties?list=custom" \
  -H "Authorization: Bearer $LOOPS_API_KEY"
```

Expected: an entry `{"key":"signedUpDate","label":"Signed Up Date","type":"date"}`. If it reports `number`, the name was already taken by a bad probe — pick `joinedDate` instead and use that name consistently from Task 1 onward.

- [ ] **Step 3: No commit**

This task touches no files. Nothing to commit.

---

### Task 1: Pure contact-mapping rules

**Files:**
- Create: `apps/server/src/loops/loops.contacts.ts`
- Test: `apps/server/src/loops/__tests__/loops.contacts.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all used by Tasks 2–4:
  - `LOOPS_SOURCE: string` (`'snaprec-app'`)
  - `DEFAULT_EXCLUDED_DOMAINS: string[]`
  - `interface LoopsContactSource { id: string; supabaseId: string | null; email: string | null; fullName: string | null; createdAt: Date }`
  - `interface LoopsCreatePayload { email: string; firstName?: string; lastName?: string; userId: string; source: string; signedUpDate: number; mailingLists: Record<string, boolean> }`
  - `interface LoopsUpdatePayload { email: string; firstName?: string; lastName?: string; userId: string }`
  - `splitName(fullName?: string | null): { firstName?: string; lastName?: string }`
  - `parseExcludedDomains(raw?: string): string[]`
  - `isExcludedEmail(email: string, excludedDomains: string[]): boolean`
  - `buildCreatePayload(user: LoopsContactSource, mailingListId: string): LoopsCreatePayload`
  - `buildUpdatePayload(user: LoopsContactSource): LoopsUpdatePayload`
  - `selectSyncableUsers(users: LoopsContactSource[], excludedDomains: string[]): LoopsContactSource[]`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/loops/__tests__/loops.contacts.spec.ts`:

```ts
import {
    LOOPS_SOURCE,
    LoopsContactSource,
    splitName,
    parseExcludedDomains,
    isExcludedEmail,
    buildCreatePayload,
    buildUpdatePayload,
    selectSyncableUsers,
} from '../loops.contacts';

const LIST_ID = 'list_abc123';

function user(overrides: Partial<LoopsContactSource> = {}): LoopsContactSource {
    return {
        id: 'db-uuid-1',
        supabaseId: 'sb-123',
        email: 'Ada@Example.com',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ...overrides,
    };
}

describe('splitName', () => {
    it('splits a two-part name', () => {
        expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('treats everything after the first space as the last name', () => {
        expect(splitName('Maria del Carmen Ruiz')).toEqual({
            firstName: 'Maria',
            lastName: 'del Carmen Ruiz',
        });
    });

    it('returns only a first name for a single word', () => {
        expect(splitName('Prince')).toEqual({ firstName: 'Prince' });
    });

    it('collapses surrounding and inner whitespace', () => {
        expect(splitName('  Ada   Lovelace  ')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('returns an empty object for missing or blank names', () => {
        expect(splitName(null)).toEqual({});
        expect(splitName(undefined)).toEqual({});
        expect(splitName('   ')).toEqual({});
    });
});

describe('parseExcludedDomains', () => {
    it('parses a comma list, stripping @ and whitespace and lowercasing', () => {
        expect(parseExcludedDomains(' @CodingCops.com , Example.ORG ')).toEqual([
            'codingcops.com',
            'example.org',
        ]);
    });

    it('falls back to the default when unset or blank', () => {
        expect(parseExcludedDomains(undefined)).toEqual(['codingcops.com']);
        expect(parseExcludedDomains('')).toEqual(['codingcops.com']);
        expect(parseExcludedDomains('  ,  ')).toEqual(['codingcops.com']);
    });
});

describe('isExcludedEmail', () => {
    const domains = ['codingcops.com'];

    it('excludes an exact domain match', () => {
        expect(isExcludedEmail('gm@codingcops.com', domains)).toBe(true);
    });

    it('excludes a subdomain', () => {
        expect(isExcludedEmail('gm@mail.codingcops.com', domains)).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isExcludedEmail('GM@CodingCops.COM', domains)).toBe(true);
    });

    it('does not exclude a lookalike domain', () => {
        expect(isExcludedEmail('gm@notcodingcops.com', domains)).toBe(false);
    });

    it('allows unrelated domains', () => {
        expect(isExcludedEmail('someone@gmail.com', domains)).toBe(false);
    });
});

describe('buildCreatePayload', () => {
    it('lowercases and trims the email', () => {
        expect(buildCreatePayload(user({ email: '  Ada@Example.COM ' }), LIST_ID).email).toBe(
            'ada@example.com',
        );
    });

    it('uses supabaseId as userId', () => {
        expect(buildCreatePayload(user(), LIST_ID).userId).toBe('sb-123');
    });

    it('falls back to the database id when supabaseId is null', () => {
        expect(buildCreatePayload(user({ supabaseId: null }), LIST_ID).userId).toBe('db-uuid-1');
    });

    it('sets source and signedUpDate as a millisecond timestamp', () => {
        const payload = buildCreatePayload(user(), LIST_ID);
        expect(payload.source).toBe(LOOPS_SOURCE);
        expect(payload.signedUpDate).toBe(new Date('2026-01-15T10:00:00.000Z').getTime());
    });

    it('adds the contact to the mailing list', () => {
        expect(buildCreatePayload(user(), LIST_ID).mailingLists).toEqual({ [LIST_ID]: true });
    });

    it('omits name fields entirely when fullName is missing', () => {
        const payload = buildCreatePayload(user({ fullName: null }), LIST_ID);
        expect('firstName' in payload).toBe(false);
        expect('lastName' in payload).toBe(false);
    });

    it('NEVER includes subscribed', () => {
        expect('subscribed' in buildCreatePayload(user(), LIST_ID)).toBe(false);
    });
});

describe('buildUpdatePayload', () => {
    it('carries email, name and userId', () => {
        expect(buildUpdatePayload(user())).toEqual({
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            userId: 'sb-123',
        });
    });

    it('NEVER includes subscribed — it would resubscribe an opted-out contact', () => {
        expect('subscribed' in buildUpdatePayload(user())).toBe(false);
    });

    it('NEVER includes mailingLists — it would re-add someone who left the list', () => {
        expect('mailingLists' in buildUpdatePayload(user())).toBe(false);
    });
});

describe('selectSyncableUsers', () => {
    const domains = ['codingcops.com'];

    it('drops users without an email', () => {
        const result = selectSyncableUsers([user({ email: null }), user({ email: 'a@gmail.com' })], domains);
        expect(result.map(u => u.email)).toEqual(['a@gmail.com']);
    });

    it('drops excluded internal domains', () => {
        const result = selectSyncableUsers(
            [user({ email: 'gm@codingcops.com' }), user({ email: 'a@gmail.com' })],
            domains,
        );
        expect(result.map(u => u.email)).toEqual(['a@gmail.com']);
    });

    it('dedupes by lowercased email, keeping the first occurrence', () => {
        const result = selectSyncableUsers(
            [
                user({ id: 'first', email: 'Dup@Gmail.com' }),
                user({ id: 'second', email: 'dup@gmail.com' }),
            ],
            domains,
        );
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('first');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/server && npx jest src/loops/__tests__/loops.contacts.spec.ts
```

Expected: FAIL — `Cannot find module '../loops.contacts'`.

- [ ] **Step 3: Write the implementation**

Create `apps/server/src/loops/loops.contacts.ts`:

```ts
/**
 * Pure mapping rules between SnapRec users and Loops contacts.
 *
 * No I/O lives here so both the Nest service and the backfill script can share
 * one copy of the rules — in particular the opt-out rule, which must never
 * differ between the two paths.
 */

export const LOOPS_SOURCE = 'snaprec-app';
export const DEFAULT_EXCLUDED_DOMAINS = ['codingcops.com'];

/** The subset of the User entity the Loops sync needs. */
export interface LoopsContactSource {
    id: string;
    supabaseId: string | null;
    email: string | null;
    fullName: string | null;
    createdAt: Date;
}

export interface LoopsCreatePayload {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    source: string;
    signedUpDate: number;
    mailingLists: Record<string, boolean>;
}

/**
 * Deliberately narrower than the create payload: no `subscribed` and no
 * `mailingLists`. See THE OPT-OUT RULE in the plan.
 */
export interface LoopsUpdatePayload {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
}

export function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
    const trimmed = (fullName ?? '').trim();
    if (!trimmed) return {};

    const match = /^(\S+)\s+([\s\S]+)$/.exec(trimmed);
    if (!match) return { firstName: trimmed };

    return { firstName: match[1], lastName: match[2].trim() };
}

export function parseExcludedDomains(raw?: string): string[] {
    const parsed = (raw ?? '')
        .split(',')
        .map(d => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean);

    return parsed.length ? parsed : [...DEFAULT_EXCLUDED_DOMAINS];
}

export function isExcludedEmail(email: string, excludedDomains: string[]): boolean {
    const domain = email.split('@').pop()?.toLowerCase() ?? '';
    return excludedDomains.some(d => domain === d || domain.endsWith(`.${d}`));
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function userIdOf(user: LoopsContactSource): string {
    return user.supabaseId ?? user.id;
}

export function buildCreatePayload(
    user: LoopsContactSource,
    mailingListId: string,
): LoopsCreatePayload {
    return {
        email: normalizeEmail(user.email!),
        ...splitName(user.fullName),
        userId: userIdOf(user),
        source: LOOPS_SOURCE,
        signedUpDate: user.createdAt.getTime(),
        mailingLists: { [mailingListId]: true },
    };
}

export function buildUpdatePayload(user: LoopsContactSource): LoopsUpdatePayload {
    return {
        email: normalizeEmail(user.email!),
        ...splitName(user.fullName),
        userId: userIdOf(user),
    };
}

/** Drops users with no email, internal addresses, and duplicate emails. */
export function selectSyncableUsers(
    users: LoopsContactSource[],
    excludedDomains: string[],
): LoopsContactSource[] {
    const seen = new Set<string>();
    const syncable: LoopsContactSource[] = [];

    for (const user of users) {
        if (!user.email) continue;

        const key = normalizeEmail(user.email);
        if (!key) continue;
        if (isExcludedEmail(key, excludedDomains)) continue;
        if (seen.has(key)) continue;

        seen.add(key);
        syncable.push(user);
    }

    return syncable;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/server && npx jest src/loops/__tests__/loops.contacts.spec.ts
```

Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/loops/loops.contacts.ts apps/server/src/loops/__tests__/loops.contacts.spec.ts
git commit -m "feat(server): add pure Loops contact mapping rules

Payload builders omit `subscribed` always and `mailingLists` on update, so a
sync can never resubscribe a contact who opted out. Tested explicitly."
```

---

### Task 2: HTTP client with the 409 fallback

**Files:**
- Create: `apps/server/src/loops/loops.client.ts`
- Test: `apps/server/src/loops/__tests__/loops.client.spec.ts`

**Interfaces:**
- Consumes from Task 1: `LoopsContactSource`, `buildCreatePayload`, `buildUpdatePayload`.
- Produces, used by Tasks 3–4:
  - `LOOPS_API_BASE: string`
  - `type UpsertOutcome = 'created' | 'updated'`
  - `class LoopsApiError extends Error { readonly status: number }`
  - `class LoopsClient` with constructor `(apiKey: string, mailingListId: string, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void>)` and method `upsertContact(user: LoopsContactSource): Promise<UpsertOutcome>`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/loops/__tests__/loops.client.spec.ts`:

```ts
import { LoopsClient, LoopsApiError } from '../loops.client';
import { LoopsContactSource } from '../loops.contacts';

const LIST_ID = 'list_abc123';

function user(overrides: Partial<LoopsContactSource> = {}): LoopsContactSource {
    return {
        id: 'db-uuid-1',
        supabaseId: 'sb-123',
        email: 'ada@example.com',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ...overrides,
    };
}

/** Builds a fetch double that returns the queued responses in order. */
function fetchStub(queue: Array<{ status: number; body?: unknown }>) {
    const calls: Array<{ url: string; method: string; body: any }> = [];

    const impl = jest.fn(async (url: any, init: any) => {
        const next = queue.shift();
        if (!next) throw new Error(`Unexpected extra fetch call to ${url}`);
        calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
        return {
            ok: next.status >= 200 && next.status < 300,
            status: next.status,
            json: async () => next.body ?? {},
            text: async () => JSON.stringify(next.body ?? {}),
        } as any;
    });

    return { impl: impl as unknown as typeof fetch, calls };
}

const noSleep = async () => undefined;

describe('LoopsClient.upsertContact', () => {
    it('creates a new contact and reports "created"', async () => {
        const { impl, calls } = fetchStub([{ status: 200, body: { success: true, id: 'c1' } }]);
        const client = new LoopsClient('key', LIST_ID, impl, noSleep);

        await expect(client.upsertContact(user())).resolves.toBe('created');

        expect(calls).toHaveLength(1);
        expect(calls[0].method).toBe('POST');
        expect(calls[0].url).toContain('/contacts/create');
        expect(calls[0].body.mailingLists).toEqual({ [LIST_ID]: true });
    });

    it('falls back to update on 409 and reports "updated"', async () => {
        const { impl, calls } = fetchStub([
            { status: 409, body: { success: false, message: 'Email or userId is already in your audience.' } },
            { status: 200, body: { success: true, id: 'c1' } },
        ]);
        const client = new LoopsClient('key', LIST_ID, impl, noSleep);

        await expect(client.upsertContact(user())).resolves.toBe('updated');

        expect(calls).toHaveLength(2);
        expect(calls[1].method).toBe('PUT');
        expect(calls[1].url).toContain('/contacts/update');
    });

    it('never sends subscribed on either request', async () => {
        const { impl, calls } = fetchStub([
            { status: 409, body: { success: false } },
            { status: 200, body: { success: true } },
        ]);
        await new LoopsClient('key', LIST_ID, impl, noSleep).upsertContact(user());

        for (const call of calls) {
            expect('subscribed' in call.body).toBe(false);
        }
    });

    it('never sends mailingLists on the update request', async () => {
        const { impl, calls } = fetchStub([
            { status: 409, body: { success: false } },
            { status: 200, body: { success: true } },
        ]);
        await new LoopsClient('key', LIST_ID, impl, noSleep).upsertContact(user());

        expect('mailingLists' in calls[1].body).toBe(false);
    });

    it('sends the bearer token', async () => {
        const impl = jest.fn(async (_url: any, init: any) => ({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
            text: async () => '{}',
        })) as any;

        await new LoopsClient('secret-key', LIST_ID, impl, noSleep).upsertContact(user());

        expect(impl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-key');
    });

    it('retries after a 429 and then succeeds', async () => {
        const { impl, calls } = fetchStub([
            { status: 429, body: { message: 'rate limited' } },
            { status: 200, body: { success: true, id: 'c1' } },
        ]);
        const sleep = jest.fn(async () => undefined);

        await expect(new LoopsClient('key', LIST_ID, impl, sleep).upsertContact(user())).resolves.toBe(
            'created',
        );

        expect(calls).toHaveLength(2);
        expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('throws LoopsApiError on a server error', async () => {
        const { impl } = fetchStub([{ status: 500, body: { message: 'boom' } }]);
        const client = new LoopsClient('key', LIST_ID, impl, noSleep);

        await expect(client.upsertContact(user())).rejects.toBeInstanceOf(LoopsApiError);
    });

    it('reports the status on the thrown error', async () => {
        const { impl } = fetchStub([{ status: 500, body: { message: 'boom' } }]);
        const client = new LoopsClient('key', LIST_ID, impl, noSleep);

        await expect(client.upsertContact(user())).rejects.toMatchObject({ status: 500 });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/server && npx jest src/loops/__tests__/loops.client.spec.ts
```

Expected: FAIL — `Cannot find module '../loops.client'`.

- [ ] **Step 3: Write the implementation**

Create `apps/server/src/loops/loops.client.ts`:

```ts
import {
    LoopsContactSource,
    buildCreatePayload,
    buildUpdatePayload,
} from './loops.contacts';

export const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

/** Loops allows 10 requests/second per team. */
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

export type UpsertOutcome = 'created' | 'updated';

export class LoopsApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'LoopsApiError';
    }
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Nest-free so the backfill script can use it without bootstrapping the app.
 * `fetchImpl` and `sleep` are injectable purely for tests.
 */
export class LoopsClient {
    constructor(
        private readonly apiKey: string,
        private readonly mailingListId: string,
        private readonly fetchImpl: typeof fetch = fetch,
        private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
    ) { }

    /**
     * Creates the contact, falling back to an update when Loops reports it
     * already exists (409).
     *
     * The update payload deliberately omits `subscribed` and `mailingLists`, so
     * syncing an existing contact can never resubscribe someone who opted out
     * or re-add someone who left the mailing list.
     */
    async upsertContact(user: LoopsContactSource): Promise<UpsertOutcome> {
        const created = await this.request(
            'POST',
            '/contacts/create',
            buildCreatePayload(user, this.mailingListId),
        );

        if (created.status === 409) {
            await this.request('PUT', '/contacts/update', buildUpdatePayload(user));
            return 'updated';
        }

        return 'created';
    }

    private async request(
        method: 'POST' | 'PUT',
        path: string,
        body: unknown,
        attempt = 0,
    ): Promise<{ status: number }> {
        const response = await this.fetchImpl(`${LOOPS_API_BASE}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (response.status === 429 && attempt < MAX_RETRIES) {
            await this.sleep(BASE_BACKOFF_MS * 2 ** attempt);
            return this.request(method, path, body, attempt + 1);
        }

        // Expected for an existing contact — the caller turns this into an update.
        if (response.status === 409) {
            return { status: 409 };
        }

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new LoopsApiError(
                `Loops ${method} ${path} failed with ${response.status}: ${detail}`,
                response.status,
            );
        }

        return { status: response.status };
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/server && npx jest src/loops/__tests__/loops.client.spec.ts
```

Expected: PASS — 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/loops/loops.client.ts apps/server/src/loops/__tests__/loops.client.spec.ts
git commit -m "feat(server): add Loops HTTP client with 409 create-then-update fallback

Uses Node 22 global fetch rather than adding a dependency. Backs off on 429
and surfaces other failures as LoopsApiError."
```

---

### Task 3: Nest service, module, and signup wiring

**Files:**
- Create: `apps/server/src/loops/loops.service.ts`
- Create: `apps/server/src/loops/loops.module.ts`
- Modify: `apps/server/src/users/users.module.ts`
- Modify: `apps/server/src/users/users.service.ts:1-15` (imports and constructor) and `:37-42` (the fire-and-forget block)
- Modify: `apps/server/src/app.module.ts` (register `LoopsModule`)
- Test: `apps/server/src/loops/__tests__/loops.service.spec.ts`
- Test: `apps/server/src/loops/__tests__/loops-signup-wiring.spec.ts`

**Interfaces:**
- Consumes from Tasks 1–2: `LoopsClient`, `LoopsContactSource`, `isExcludedEmail`, `parseExcludedDomains`.
- Produces: `LoopsService` with `upsertContact(user: LoopsContactSource): Promise<void>` — never throws; `LoopsModule` exporting it.

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/loops/__tests__/loops.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { LoopsService } from '../loops.service';
import { LoopsContactSource } from '../loops.contacts';

function configWith(values: Record<string, string | undefined>): ConfigService {
    return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function user(overrides: Partial<LoopsContactSource> = {}): LoopsContactSource {
    return {
        id: 'db-uuid-1',
        supabaseId: 'sb-123',
        email: 'ada@example.com',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
        ...overrides,
    };
}

describe('LoopsService', () => {
    it('is disabled and does not throw when the API key is missing', async () => {
        const service = new LoopsService(
            configWith({ LOOPS_MAILING_LIST_ID: 'list_1' }),
        );

        await expect(service.upsertContact(user())).resolves.toBeUndefined();
    });

    it('is disabled and does not throw when the mailing list id is missing', async () => {
        const service = new LoopsService(configWith({ LOOPS_API_KEY: 'key' }));

        await expect(service.upsertContact(user())).resolves.toBeUndefined();
    });

    it('skips users without an email', async () => {
        const upsert = jest.fn();
        const service = new LoopsService(
            configWith({ LOOPS_API_KEY: 'key', LOOPS_MAILING_LIST_ID: 'list_1' }),
        );
        (service as any).client = { upsertContact: upsert };

        await expect(service.upsertContact(user({ email: null }))).resolves.toBeUndefined();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('skips internal addresses so they never reach the Loops API', async () => {
        const upsert = jest.fn();
        const service = new LoopsService(
            configWith({
                LOOPS_API_KEY: 'key',
                LOOPS_MAILING_LIST_ID: 'list_1',
                EXCLUDED_DOMAINS: 'codingcops.com',
            }),
        );
        (service as any).client = { upsertContact: upsert };

        await service.upsertContact(user({ email: 'gm@codingcops.com' }));

        expect(upsert).not.toHaveBeenCalled();
    });

    it('forwards a syncable user to the client', async () => {
        const upsert = jest.fn().mockResolvedValue('created');
        const service = new LoopsService(
            configWith({ LOOPS_API_KEY: 'key', LOOPS_MAILING_LIST_ID: 'list_1' }),
        );
        (service as any).client = { upsertContact: upsert };

        await service.upsertContact(user());

        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert.mock.calls[0][0].email).toBe('ada@example.com');
    });
});
```

Create `apps/server/src/loops/__tests__/loops-signup-wiring.spec.ts` — this exists to protect the fire-and-forget property, which is the part most likely to regress:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { LoopsService } from '../loops.service';

describe('Loops contact sync on signup', () => {
    let usersService: UsersService;
    let loopsUpsert: jest.Mock;
    let repo: { findOne: jest.Mock; save: jest.Mock };

    beforeEach(async () => {
        loopsUpsert = jest.fn().mockResolvedValue(undefined);
        repo = {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation(async (u: User) => u),
        };

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: repo },
                { provide: MailService, useValue: { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) } },
                { provide: LoopsService, useValue: { upsertContact: loopsUpsert } },
            ],
        }).compile();

        usersService = moduleRef.get(UsersService);
    });

    it('syncs a newly created user to Loops', async () => {
        await usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com', fullName: 'A B' });

        expect(loopsUpsert).toHaveBeenCalledTimes(1);
        expect(loopsUpsert.mock.calls[0][0].email).toBe('a@gmail.com');
    });

    it('does not sync a user who has no email', async () => {
        await usersService.findOrCreateBySupabaseId('sb-1', { fullName: 'A B' });

        expect(loopsUpsert).not.toHaveBeenCalled();
    });

    it('still resolves when the Loops sync rejects — signup must never fail on Loops', async () => {
        loopsUpsert.mockRejectedValue(new Error('Loops is down'));

        await expect(
            usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com', fullName: 'A B' }),
        ).resolves.toBeDefined();
    });

    it('does not sync an existing user again', async () => {
        const existing = Object.assign(new User(), {
            id: 'db-1',
            supabaseId: 'sb-1',
            email: 'a@gmail.com',
            fullName: 'A B',
        });
        repo.findOne.mockResolvedValue(existing);

        await usersService.findOrCreateBySupabaseId('sb-1', { email: 'a@gmail.com' });

        expect(loopsUpsert).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/server && npx jest src/loops/__tests__/loops.service.spec.ts src/loops/__tests__/loops-signup-wiring.spec.ts
```

Expected: FAIL — `Cannot find module '../loops.service'`.

- [ ] **Step 3: Write the service and module**

Create `apps/server/src/loops/loops.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoopsClient } from './loops.client';
import {
    LoopsContactSource,
    isExcludedEmail,
    parseExcludedDomains,
} from './loops.contacts';

@Injectable()
export class LoopsService {
    private readonly logger = new Logger(LoopsService.name);
    private readonly client: LoopsClient | null;
    private readonly excludedDomains: string[];

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('LOOPS_API_KEY');
        const mailingListId = this.configService.get<string>('LOOPS_MAILING_LIST_ID');
        this.excludedDomains = parseExcludedDomains(
            this.configService.get<string>('EXCLUDED_DOMAINS'),
        );

        if (!apiKey || !mailingListId) {
            this.logger.warn(
                'LOOPS_API_KEY or LOOPS_MAILING_LIST_ID is not set — Loops contact sync is disabled',
            );
            this.client = null;
            return;
        }

        this.client = new LoopsClient(apiKey, mailingListId);
    }

    /**
     * Mirror a user into the Loops audience.
     *
     * Called fire-and-forget from the signup path, so it must never throw and
     * never block. Internal addresses are dropped before any network call.
     */
    async upsertContact(user: LoopsContactSource): Promise<void> {
        if (!this.client || !user.email) return;

        const email = user.email.trim().toLowerCase();
        if (isExcludedEmail(email, this.excludedDomains)) {
            this.logger.log(`Skipping Loops sync for internal address ${email}`);
            return;
        }

        const outcome = await this.client.upsertContact(user);
        this.logger.log(`Loops contact ${outcome}: ${email}`);
    }
}
```

Create `apps/server/src/loops/loops.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LoopsService } from './loops.service';

@Module({
    providers: [LoopsService],
    exports: [LoopsService],
})
export class LoopsModule { }
```

- [ ] **Step 4: Wire it into the users module**

In `apps/server/src/users/users.module.ts`, add the import and register the module:

```ts
import { LoopsModule } from '../loops/loops.module';
```

and change the `imports` array to:

```ts
    imports: [TypeOrmModule.forFeature([User]), MailModule, LoopsModule],
```

- [ ] **Step 5: Wire it into the signup path**

In `apps/server/src/users/users.service.ts`, add the import beside the existing `MailService` import:

```ts
import { LoopsService } from '../loops/loops.service';
```

Add the constructor parameter after `mailService`:

```ts
        private readonly mailService: MailService,
        private readonly loopsService: LoopsService,
```

Then extend the existing fire-and-forget block (currently lines 37-42) so it reads:

```ts
                // Fire-and-forget: send welcome email without blocking user creation
                if (user.email) {
                    this.mailService.sendWelcomeEmail(user.email, user.fullName)
                        .catch(err => this.logger.error('Failed to queue welcome email', err));

                    // Fire-and-forget: mirror the contact into the Loops audience so
                    // bulk campaigns can reach them. A Loops outage must not fail signup.
                    this.loopsService.upsertContact(user)
                        .catch(err => this.logger.error('Failed to sync Loops contact', err));
                }
```

- [ ] **Step 6: Register the module in the app module**

In `apps/server/src/app.module.ts`, add the import:

```ts
import { LoopsModule } from './loops/loops.module';
```

and add `LoopsModule` to the `imports` array alongside the other feature modules.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd apps/server && npx jest src/loops
```

Expected: PASS — all three Loops suites green.

- [ ] **Step 8: Verify the whole suite and the build still pass**

```bash
cd apps/server && npm test && npm run build
```

Expected: all suites pass; `nest build` completes with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/loops apps/server/src/users/users.module.ts apps/server/src/users/users.service.ts apps/server/src/app.module.ts
git commit -m "feat(server): sync new signups into the Loops audience

Fire-and-forget beside the existing welcome email, matching that pattern, so a
Loops outage can never fail or slow user creation. Degrades to a no-op when the
Loops env vars are unset."
```

---

### Task 4: Backfill script for existing users

**Files:**
- Create: `apps/server/src/scripts/sync-loops-contacts.ts`
- Modify: `apps/server/package.json` (scripts block)

**Interfaces:**
- Consumes from Tasks 1–2: `LoopsClient`, `LoopsApiError`, `LoopsContactSource`, `selectSyncableUsers`, `parseExcludedDomains`, `buildCreatePayload`.
- Produces: `npm run script:sync-loops-contacts` and `npm run script:sync-loops-contacts:dry`.

- [ ] **Step 1: Write the script**

Create `apps/server/src/scripts/sync-loops-contacts.ts`:

```ts
/**
 * Backfill: mirror every SnapRec user into the Loops audience.
 *
 * New signups sync automatically via LoopsService. This script exists to
 * backfill users who registered before that hook, and to repair drift.
 *
 * Usage:
 *   cd apps/server && npm run script:sync-loops-contacts
 *
 * Dry run (no API calls, prints the mapped payloads):
 *   npm run script:sync-loops-contacts:dry
 *
 * Env: LOOPS_API_KEY, LOOPS_MAILING_LIST_ID, DB_*
 * Optional: DRY_RUN=1, LOOPS_MIN_CONTACTS (default 10), EXCLUDED_DOMAINS
 *           (default codingcops.com), LOOPS_DELAY_MS (default 150)
 */
import * as dotenv from 'dotenv';

dotenv.config();

import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Reaction } from '../recordings/entities/reaction.entity';
import { Comment } from '../recordings/entities/comment.entity';
import { LoopsClient, LoopsApiError } from '../loops/loops.client';
import {
    LoopsContactSource,
    buildCreatePayload,
    parseExcludedDomains,
    selectSyncableUsers,
} from '../loops/loops.contacts';

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_MAILING_LIST_ID = process.env.LOOPS_MAILING_LIST_ID;
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const MIN_CONTACTS = Number(process.env.LOOPS_MIN_CONTACTS ?? 10);
// Loops allows 10 req/s per team; 150ms keeps a comfortable margin.
const DELAY_MS = Number(process.env.LOOPS_DELAY_MS) || 150;

const excludedDomains = parseExcludedDomains(process.env.EXCLUDED_DOMAINS);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function main() {
    if (!DRY_RUN && (!LOOPS_API_KEY || !LOOPS_MAILING_LIST_ID)) {
        console.error('❌ LOOPS_API_KEY and LOOPS_MAILING_LIST_ID must be set (or use DRY_RUN=1)');
        process.exit(1);
    }

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Recording, Reaction, Comment],
        ssl: { rejectUnauthorized: false },
    });

    await dataSource.initialize();
    console.log('✅ Connected to database');
    console.log(`🗄️  DB: ${process.env.DB_USERNAME}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
    console.log(`🚫 Excluding domains: ${excludedDomains.map(d => '@' + d).join(', ')}`);

    const users = await dataSource.getRepository(User).find();
    const syncable = selectSyncableUsers(users as LoopsContactSource[], excludedDomains);

    console.log(`👥 ${syncable.length} syncable contact(s) of ${users.length} users`);
    console.log(DRY_RUN ? '🔶 DRY RUN — no API calls will be made\n' : '📤 LIVE SYNC\n');

    // A sync that finds almost no one usually means the wrong database, not a
    // small user base. The local .env points at a small dev Supabase project.
    if (!DRY_RUN && syncable.length < MIN_CONTACTS) {
        console.error(
            `\n❌ Only ${syncable.length} contact(s) found, below LOOPS_MIN_CONTACTS=${MIN_CONTACTS}.\n` +
            `   Check that DB_* in .env points at the production database.\n` +
            `   To sync anyway: LOOPS_MIN_CONTACTS=1 npm run script:sync-loops-contacts`,
        );
        await dataSource.destroy();
        process.exit(1);
    }

    if (syncable.length === 0) {
        console.log('Nothing to sync.');
        await dataSource.destroy();
        return;
    }

    const client = DRY_RUN
        ? null
        : new LoopsClient(LOOPS_API_KEY!, LOOPS_MAILING_LIST_ID!);

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const user of syncable) {
        if (DRY_RUN) {
            console.log(
                `  [dry-run] ${user.email} → ${JSON.stringify(
                    buildCreatePayload(user, LOOPS_MAILING_LIST_ID ?? 'LIST_ID'),
                )}`,
            );
            continue;
        }

        try {
            const outcome = await client!.upsertContact(user);
            if (outcome === 'created') created++;
            else updated++;
            console.log(`  ✅ ${outcome.padEnd(7)} ${user.email}`);
        } catch (err) {
            failed++;
            const detail = err instanceof LoopsApiError ? `${err.status} ${err.message}` : String(err);
            console.error(`  ❌ ${user.email} — ${detail}`);
        }

        await sleep(DELAY_MS);
    }

    console.log(
        DRY_RUN
            ? `\n📊 Dry run: ${syncable.length} would be synced`
            : `\n📊 Done: ${created} created, ${updated} updated, ${failed} failed`,
    );

    await dataSource.destroy();
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Add the npm scripts**

In `apps/server/package.json`, add these two entries to the `scripts` block:

```json
    "script:sync-loops-contacts": "ts-node -r dotenv/config src/scripts/sync-loops-contacts.ts",
    "script:sync-loops-contacts:dry": "DRY_RUN=1 ts-node -r dotenv/config src/scripts/sync-loops-contacts.ts",
```

- [ ] **Step 3: Verify the dry run**

```bash
cd apps/server && npm run script:sync-loops-contacts:dry
```

Expected: connects to the DB, prints the syncable count and one `[dry-run]` line per contact showing the mapped payload. Confirm by eye that each payload contains `mailingLists` and **no** `subscribed` key.

- [ ] **Step 4: Verify the safety guard actually fires**

The local `.env` points at a small dev Supabase project, so a live run should refuse:

```bash
cd apps/server && npm run script:sync-loops-contacts
```

Expected: exits non-zero with `below LOOPS_MIN_CONTACTS=10` and the hint about checking `DB_*`. This confirms the guard works.

- [ ] **Step 5: Do a real sync against the dev DB**

```bash
cd apps/server && LOOPS_MIN_CONTACTS=1 npm run script:sync-loops-contacts
```

Expected: `created` lines for each dev user, then a summary. Verify in Loops (Audience) that the contacts appear with `firstName`, `signedUpDate`, and membership in "Snaprec Loops List".

- [ ] **Step 6: Verify idempotency**

Run the exact same command again:

```bash
cd apps/server && LOOPS_MIN_CONTACTS=1 npm run script:sync-loops-contacts
```

Expected: every line now reports `updated` rather than `created`, and no duplicate contacts appear in Loops. This exercises the 409 fallback against the live API.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/scripts/sync-loops-contacts.ts apps/server/package.json
git commit -m "feat(server): add Loops contact backfill script

Guarded by LOOPS_MIN_CONTACTS so it refuses to run against the dev database,
mirroring the MIN_RECIPIENTS guard the old broadcast scripts used."
```

---

### Task 5: Remove the bulk email scripts and update docs

**Files:**
- Delete: `apps/server/src/scripts/send-patreon-support.ts`
- Delete: `apps/server/src/scripts/send-auto-zoom-launch.ts`
- Delete: `apps/server/src/scripts/send-video-editor-launch.ts`
- Delete: `apps/server/src/mail/templates/patreon-support.ts`
- Delete: `apps/server/src/mail/templates/auto-zoom-launch.ts`
- Delete: `apps/server/src/mail/templates/video-editor-launch.ts`
- Modify: `apps/server/package.json` (remove six `script:email-*` entries)
- Modify: `apps/server/.env.example`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This task only removes code and updates documentation.

- [ ] **Step 1: Confirm nothing still imports the bulk templates**

```bash
cd /Users/codincops/Desktop/Projects/screenshoter
grep -rn "patreon-support\|auto-zoom-launch\|video-editor-launch" apps/server/src --include=*.ts
```

Expected: matches **only** inside the six files being deleted. If anything else references them, stop and reassess — `welcome.ts` and `founder-welcome.ts` must remain untouched.

- [ ] **Step 2: Delete the scripts and templates**

```bash
cd /Users/codincops/Desktop/Projects/screenshoter
git rm apps/server/src/scripts/send-patreon-support.ts \
       apps/server/src/scripts/send-auto-zoom-launch.ts \
       apps/server/src/scripts/send-video-editor-launch.ts \
       apps/server/src/mail/templates/patreon-support.ts \
       apps/server/src/mail/templates/auto-zoom-launch.ts \
       apps/server/src/mail/templates/video-editor-launch.ts
```

- [ ] **Step 3: Remove the six npm script entries**

From `apps/server/package.json`, delete these lines from the `scripts` block:

```
"script:email-video-editor-launch"
"script:email-video-editor-launch:test"
"script:email-auto-zoom-launch"
"script:email-auto-zoom-launch:test"
"script:email-patreon-support"
"script:email-patreon-support:dry"
"script:email-patreon-support:test"
```

Keep every other script. Verify the file is still valid JSON:

```bash
cd apps/server && python3 -c "import json; json.load(open('package.json')); print('valid json')"
```

- [ ] **Step 4: Update `.env.example`**

Under the existing `# Resend (Email)` block in `apps/server/.env.example`, add:

```
# Loops.so (bulk / promotional email — transactional stays on Resend)
LOOPS_API_KEY=your_loops_api_key
LOOPS_MAILING_LIST_ID=your_mailing_list_id
# Refuse to backfill below this many contacts (guards against a dev database)
LOOPS_MIN_CONTACTS=10
```

Leave `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in place. **Placeholders only — never the real key.**

- [ ] **Step 5: Update `CLAUDE.md`**

In the "Server modules" paragraph, replace the `mail/` description so it reads:

```
`mail/` (Resend — transactional only: welcome and founder-welcome, templates in
`mail/templates/`) · `loops/` (Loops.so contact sync for bulk/promotional email —
audience mirroring only; campaign copy is authored in the Loops dashboard, not in
this repo)
```

Then add this to the same section:

```
**Email is split across two providers by use case.** Resend sends transactional
mail (raw HTML templates in `mail/templates/`). Loops owns bulk promotional mail:
Loops accepts no raw HTML — its bodies are LMX, and MJML is rejected — so bulk
copy lives in the Loops editor. The server's only job is keeping the audience
accurate via `LoopsService` (fire-and-forget on signup) and
`npm run script:sync-loops-contacts` (backfill).

Never send `subscribed` to the Loops API, and send `mailingLists` only when
creating a contact. `subscribed: true` resubscribes someone who opted out.
```

- [ ] **Step 6: Verify the build and full test suite**

```bash
cd apps/server && npm run build && npm test
```

Expected: `nest build` succeeds with no unresolved imports from the deleted files, and every suite passes.

- [ ] **Step 7: Commit**

```bash
cd /Users/codincops/Desktop/Projects/screenshoter
git add -A apps/server/package.json apps/server/.env.example CLAUDE.md
git commit -m "refactor(server): drop bulk email scripts now that Loops owns campaigns

Removes the three broadcast scripts and their HTML templates. Loops accepts no
raw HTML, so bulk copy now lives in the Loops editor and the repo only keeps the
audience in sync. Resend keeps all transactional mail.

Copy for the removed campaigns remains in git history."
```

---

## Post-implementation manual verification

These are dashboard steps, not code:

- [ ] In Loops → Audience, confirm the synced contacts show `firstName`, `signedUpDate`, `source: snaprec-app`, and membership in "Snaprec Loops List".
- [ ] Confirm no `@codingcops.com` address is present in the audience.
- [ ] Send a test campaign to yourself from the Loops editor to confirm the sending domain is verified and mail arrives.
- [ ] Unsubscribe yourself from that test campaign, re-run `LOOPS_MIN_CONTACTS=1 npm run script:sync-loops-contacts`, and confirm in Loops that you are **still unsubscribed**. This is the end-to-end proof of the opt-out rule.
- [ ] Optional, recommended in the spec: add `rua=mailto:...` to the `_dmarc.snaprecorder.org` TXT record for DMARC visibility.
- [ ] Rotate `LOOPS_API_KEY` in Loops → Settings → API, since the current value was shared in a chat transcript. Update `apps/server/.env` and the Cloud Run environment.
