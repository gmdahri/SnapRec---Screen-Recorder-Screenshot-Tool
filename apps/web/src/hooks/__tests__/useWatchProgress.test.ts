import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SessionExpiredError } from '../../lib/sessionExpired';

/** The watch heartbeat when the server stops accepting the session.
 *
 * Every beat would carry the same dead token and earn the same 401 every ten
 * seconds, and an anonymous beat is discarded by the server anyway. So on the
 * first refusal it stops: no more requests, no console noise, nothing the
 * viewer sees. Any other failure is a dropped beat, and the next one goes. */

const fetchWithAuth = vi.fn();
vi.mock('../useRecordings', () => ({ fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args) }));
const { useWatchProgress } = await import('../useWatchProgress');

beforeEach(() => { vi.useFakeTimers(); fetchWithAuth.mockReset(); fetchWithAuth.mockResolvedValue({}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** Ten seconds of continuous watching, a seek (which closes the range — only
 * closed ranges are sent), then the timer flush. */
function watchTenSeconds(observe: (s: number) => void, from: number) {
    for (let s = from; s <= from + 10; s++) observe(s);
    observe(from + 500);
    act(() => { vi.advanceTimersByTime(10_000); });
}
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('the watch heartbeat', () => {
    it('sends quietly — no console output for an expected failure', async () => {
        fetchWithAuth.mockResolvedValue({});
        const { result } = renderHook(() => useWatchProgress('rec-1', true));
        watchTenSeconds(result.current.observe, 0);
        await settle();
        expect(fetchWithAuth).toHaveBeenCalledWith('/recordings/rec-1/progress', expect.any(Object), { quiet: true });
    });

    it('stops after the server refuses the session, without retrying or logging', async () => {
        const error = vi.spyOn(console, 'error');
        const warn = vi.spyOn(console, 'warn');
        const log = vi.spyOn(console, 'log');
        fetchWithAuth.mockRejectedValue(new SessionExpiredError());
        const { result } = renderHook(() => useWatchProgress('rec-1', true));

        watchTenSeconds(result.current.observe, 0);
        await settle();
        expect(fetchWithAuth).toHaveBeenCalledTimes(1);

        watchTenSeconds(result.current.observe, 1000);
        watchTenSeconds(result.current.observe, 2000);
        window.dispatchEvent(new Event('pagehide'));
        await settle();
        expect(fetchWithAuth).toHaveBeenCalledTimes(1);
        expect([...error.mock.calls, ...warn.mock.calls, ...log.mock.calls]).toEqual([]);
    });

    it('keeps going after an ordinary failure — one dropped beat is not a reason to stop', async () => {
        fetchWithAuth.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({});
        const { result } = renderHook(() => useWatchProgress('rec-1', true));
        watchTenSeconds(result.current.observe, 0);
        await settle();
        watchTenSeconds(result.current.observe, 1000);
        await settle();
        expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    });
});
