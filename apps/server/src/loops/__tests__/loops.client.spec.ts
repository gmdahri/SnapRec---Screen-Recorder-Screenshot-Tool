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
        const impl = jest.fn(async (_url: any, _init: any) => ({
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
