import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const events: Array<[string, Record<string, unknown>]> = [];
vi.mock('../../lib/analytics', () => ({
    capture: (e: string, p: Record<string, unknown>) => { events.push([e, p]); },
}));

const downloadFile = vi.fn();
vi.mock('../../lib/download', async (orig) => ({
    ...(await orig<typeof import('../../lib/download')>()),
    downloadFile: (...args: unknown[]) => downloadFile(...args),
}));

import { useDownload } from '../useDownload';

const names = () => events.map(([e]) => e);

describe('useDownload', () => {
    beforeEach(() => { events.length = 0; downloadFile.mockReset(); });

    it('starts idle', () => {
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));
        expect(result.current.state.status).toBe('idle');
        expect(events).toEqual([]);
    });

    it('reports started then completed on success', async () => {
        downloadFile.mockResolvedValue({ ok: true, status: 200 });
        const { result } = renderHook(() => useDownload({ surface: 'share_page', captureType: 'video' }));

        await act(async () => { await result.current.start('https://x/f.webm', 'f.webm'); });

        expect(result.current.state.status).toBe('done');
        expect(names()).toEqual(['recording_download_started', 'recording_download_completed']);
        expect(events[0][1]).toMatchObject({ surface: 'share_page', capture_type: 'video' });
        expect(events[1][1].ms).toBeTypeOf('number');
    });

    it('reports started then failed, with the reason', async () => {
        downloadFile.mockResolvedValue({ ok: false, error: 'not_found', status: 404 });
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));

        await act(async () => { await result.current.start('https://x/gone.webm'); });

        expect(result.current.state.status).toBe('error');
        expect(names()).toEqual(['recording_download_started', 'recording_download_failed']);
        expect(events[1][1]).toMatchObject({ error_reason: 'not_found', status: 404 });
    });

    /* The whole point: preparing must never be the last thing the user sees. */
    it('surfaces a human message on failure', async () => {
        downloadFile.mockResolvedValue({ ok: false, error: 'timeout' });
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));
        await act(async () => { await result.current.start('https://x/slow.webm'); });

        expect(result.current.state).toMatchObject({ status: 'error', reason: 'timeout' });
        if (result.current.state.status === 'error') {
            expect(result.current.state.message).toMatch(/did not start in time/i);
        }
    });

    it('exposes a busy flag while preparing', async () => {
        let release: (v: unknown) => void = () => {};
        downloadFile.mockReturnValue(new Promise(r => { release = r; }));
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));

        act(() => { void result.current.start('https://x/f.webm'); });
        await waitFor(() => expect(result.current.isBusy).toBe(true));

        await act(async () => { release({ ok: true }); });
        expect(result.current.isBusy).toBe(false);
    });

    /* A double-click must not fire two event pairs or two downloads. */
    it('ignores a second start while one is in flight', async () => {
        let release: (v: unknown) => void = () => {};
        downloadFile.mockReturnValue(new Promise(r => { release = r; }));
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));

        act(() => { void result.current.start('https://x/f.webm'); });
        act(() => { void result.current.start('https://x/f.webm'); });
        await act(async () => { release({ ok: true }); });

        expect(downloadFile).toHaveBeenCalledTimes(1);
        expect(names()).toEqual(['recording_download_started', 'recording_download_completed']);
    });

    it('retry repeats the last attempt and can succeed', async () => {
        downloadFile.mockResolvedValueOnce({ ok: false, error: 'network' });
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));
        await act(async () => { await result.current.start('https://x/f.webm', 'f.webm'); });
        expect(result.current.state.status).toBe('error');

        downloadFile.mockResolvedValueOnce({ ok: true, status: 200 });
        await act(async () => { result.current.retry(); });

        await waitFor(() => expect(result.current.state.status).toBe('done'));
        expect(downloadFile).toHaveBeenLastCalledWith('https://x/f.webm', 'f.webm');
    });

    it('retry before any attempt does nothing', async () => {
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));
        await act(async () => { result.current.retry(); });
        expect(downloadFile).not.toHaveBeenCalled();
        expect(events).toEqual([]);
    });

    it('reset clears the error', async () => {
        downloadFile.mockResolvedValue({ ok: false, error: 'network' });
        const { result } = renderHook(() => useDownload({ surface: 'share_page' }));
        await act(async () => { await result.current.start('https://x/f.webm'); });
        act(() => { result.current.reset(); });
        expect(result.current.state.status).toBe('idle');
    });
});
