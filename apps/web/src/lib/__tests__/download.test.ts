import { describe, expect, it, vi } from 'vitest';
import { downloadFile, downloadErrorMessage, DOWNLOAD_TIMEOUT_MS } from '../download';

const okResponse = (status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    body: { cancel: vi.fn().mockResolvedValue(undefined) },
}) as unknown as Response;

const run = (url: string | null | undefined, over: Parameters<typeof downloadFile>[2] = {}) => {
    const saved: Array<[string, string | undefined]> = [];
    const opts = {
        fetchImpl: vi.fn().mockResolvedValue(okResponse()),
        saveAs: (u: string, f?: string) => { saved.push([u, f]); },
        ...over,
    };
    return { promise: downloadFile(url, 'clip.webm', opts), saved, opts };
};

describe('downloadFile', () => {
    it('hands the download to the browser once the server responds', async () => {
        const { promise, saved } = run('https://cdn.example/clip.webm');
        await expect(promise).resolves.toEqual({ ok: true, status: 200 });
        expect(saved).toEqual([['https://cdn.example/clip.webm', 'clip.webm']]);
    });

    /* The share page used to do `if (downloadUrl) { ... }` with no else, so a
     * missing URL meant the click did nothing at all — no error, no feedback. */
    it('reports a missing URL instead of silently doing nothing', async () => {
        for (const bad of [null, undefined, '']) {
            const { promise, saved } = run(bad);
            await expect(promise).resolves.toEqual({ ok: false, error: 'no_url' });
            expect(saved).toEqual([]);
        }
    });

    /* fileUrl can come back containing the literal string "undefined" when the
     * upload half-failed; ShareView already guarded against it for the <video>
     * src, and the download path must too. */
    it('rejects a URL containing "undefined"', async () => {
        const { promise } = run('https://cdn.example/video-undefined-123.webm');
        await expect(promise).resolves.toEqual({ ok: false, error: 'no_url' });
    });

    it.each([
        [404, 'not_found'], [410, 'not_found'],
        [401, 'forbidden'], [403, 'forbidden'],
        [500, 'server_error'], [503, 'server_error'],
    ])('maps HTTP %i to %s and does not start a download', async (status, reason) => {
        const { promise, saved } = run('https://cdn.example/clip.webm', {
            fetchImpl: vi.fn().mockResolvedValue(okResponse(status)),
        });
        await expect(promise).resolves.toEqual({ ok: false, error: reason, status });
        expect(saved).toEqual([]);
    });

    it('reports a network failure rather than hanging', async () => {
        const { promise } = run('https://cdn.example/clip.webm', {
            fetchImpl: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
        });
        await expect(promise).resolves.toEqual({ ok: false, error: 'network' });
    });

    /* The reported bug: "it just keeps trying to download forever". */
    it('times out instead of waiting indefinitely', async () => {
        vi.useFakeTimers();
        const { promise } = run('https://cdn.example/clip.webm', {
            // Never resolves, but honours the abort signal like a real fetch.
            fetchImpl: ((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
                init?.signal?.addEventListener('abort', () => {
                    const e = new Error('aborted'); e.name = 'AbortError'; rej(e);
                });
            })) as unknown as typeof fetch,
            timeoutMs: 50,
        });
        await vi.advanceTimersByTimeAsync(60);
        await expect(promise).resolves.toEqual({ ok: false, error: 'timeout' });
        vi.useRealTimers();
    });

    it('defaults the timeout to 10 seconds', () => {
        expect(DOWNLOAD_TIMEOUT_MS).toBe(10_000);
    });

    it('reports a browser-blocked download', async () => {
        const { promise } = run('https://cdn.example/clip.webm', {
            saveAs: () => { throw new Error('blocked'); },
        });
        await expect(promise).resolves.toEqual({ ok: false, error: 'blocked' });
    });

    /* A 4K recording is hundreds of megabytes. The probe must never read the
     * body — the browser streams the real download to disk. */
    it('cancels the response body instead of buffering the file', async () => {
        const res = okResponse();
        const { promise } = run('https://cdn.example/clip.webm', {
            fetchImpl: vi.fn().mockResolvedValue(res),
        });
        await promise;
        expect((res.body as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel).toHaveBeenCalled();
    });

    it('survives a body that cannot be cancelled', async () => {
        const res = { ok: true, status: 200, body: { cancel: () => Promise.reject(new Error('closed')) } } as unknown as Response;
        const { promise } = run('https://cdn.example/clip.webm', {
            fetchImpl: vi.fn().mockResolvedValue(res),
        });
        await expect(promise).resolves.toMatchObject({ ok: true });
    });
});

describe('downloadErrorMessage', () => {
    it('gives every failure a message a non-technical user can act on', () => {
        for (const reason of ['no_url','timeout','not_found','forbidden','server_error','network','blocked'] as const) {
            const msg = downloadErrorMessage(reason);
            expect(msg.length, reason).toBeGreaterThan(20);
            expect(msg, reason).toMatch(/[.!]$/);
            // No jargon leaking into the UI.
            expect(msg.toLowerCase(), reason).not.toMatch(/undefined|null|http|abort/);
        }
    });
});
