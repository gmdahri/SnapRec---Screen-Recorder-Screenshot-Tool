import { describe, expect, it, vi } from 'vitest';
import { SessionExpiredError, isSessionExpired, sessionExpiredResponse } from '../lib/sessionExpired';

/** Which API answers mean "sign in again".
 *
 * 401 is the server refusing a token that no longer verifies. The 403 is the
 * one POST /recordings gives a request that names a user but carries no valid
 * token for them — a lapsed session, seen from the other side. Every other
 * refusal is an ordinary error and must not send anyone to a sign-in prompt. */

vi.mock('../lib/supabase', () => ({
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'stale' } }, error: null }) } },
}));

describe('sessionExpiredResponse', () => {
    it('401 is an expired session', () => {
        expect(sessionExpiredResponse(401, '')).toBe(true);
    });
    it('the userId-mismatch 403 is an expired session', () => {
        expect(sessionExpiredResponse(403, '{"statusCode":403,"message":"userId does not match the signed-in user"}')).toBe(true);
    });
    it('any other 403 is not — it is a real "you may not"', () => {
        expect(sessionExpiredResponse(403, '{"message":"You do not have permission to update this recording"}')).toBe(false);
    });
    it('409, 400 and 500 are not', () => {
        for (const status of [400, 409, 500]) expect(sessionExpiredResponse(status, '')).toBe(false);
    });
});

describe('fetchWithAuth', () => {
    const respond = (status: number, body: object) => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    };

    it('throws SessionExpiredError for a 401', async () => {
        respond(401, { message: 'Your session has expired. Sign in again.' });
        const { fetchWithAuth } = await import('../hooks/useRecordings');
        const error = await fetchWithAuth('/recordings', { method: 'POST' }).catch((e) => e);
        expect(isSessionExpired(error)).toBe(true);
        expect(error).toBeInstanceOf(SessionExpiredError);
    });

    it('throws SessionExpiredError for the userId-mismatch 403', async () => {
        respond(403, { message: 'userId does not match the signed-in user' });
        const { fetchWithAuth } = await import('../hooks/useRecordings');
        expect(isSessionExpired(await fetchWithAuth('/recordings').catch((e) => e))).toBe(true);
    });

    it('throws a plain error for a 409', async () => {
        respond(409, { message: 'A recording with this id already exists' });
        const { fetchWithAuth } = await import('../hooks/useRecordings');
        const error = await fetchWithAuth('/recordings').catch((e: Error) => e) as Error;
        expect(isSessionExpired(error)).toBe(false);
        expect(error.message).toMatch(/409/);
    });
});

describe('fetchWithAuth, quiet', () => {
    it('says nothing on the console for a refused session when asked to be quiet', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as typeof fetch;
        const { fetchWithAuth } = await import('../hooks/useRecordings');

        await fetchWithAuth('/recordings/x/progress', { method: 'POST' }, { quiet: true }).catch(() => {});
        expect([...error.mock.calls, ...log.mock.calls]).toEqual([]);

        await fetchWithAuth('/recordings/x/comments', { method: 'POST' }).catch(() => {});
        expect(error).toHaveBeenCalled();   // the default still reports it
        error.mockRestore(); log.mockRestore();
    });
});
