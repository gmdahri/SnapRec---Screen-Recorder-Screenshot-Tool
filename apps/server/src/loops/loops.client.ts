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
