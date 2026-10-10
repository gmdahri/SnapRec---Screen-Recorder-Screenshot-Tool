import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { forwardRef, useEffect } from 'react';

/** The share page must not flicker while it polls for a recording the server
 * does not have.
 *
 * A fresh capture whose streamed upload never registered has its local copy
 * on the page and a 404 from GET /recordings/:id, which the page polls every
 * three seconds. In TanStack Query v5 every refetch of a query with no data
 * puts it back to `pending`, so `isLoading` turned true on each poll and the
 * page swapped the player for "Preparing your recording…" and back — for two
 * minutes, unmounting the video each time.
 *
 * Real: ShareView, useRecording and React Query, polling on fake timers.
 * Mocked: the network (a 404), auth, notifications, analytics, and the player,
 * which counts how often it is mounted — a flicker is a remount. */

let playerMounts = 0;

vi.mock('../../lib/supabase', () => ({
    supabase: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } },
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: null, session: null, guestId: null, loading: false, expireSession: vi.fn(), signInWithGoogle: vi.fn() }),
}));
vi.mock('../../contexts/NotificationContext', () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock('../../lib/analytics', () => ({ capture: vi.fn() }));
vi.mock('../../hooks/useVideoFrames', () => ({ useVideoFrames: () => ({ frames: [], generating: false, blocked: false }) }));
vi.mock('../../hooks/useWatchProgress', () => ({ useWatchProgress: () => ({ observe: vi.fn() }) }));
vi.mock('../../components', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../components')>()),
    VideoPlayer: forwardRef<unknown, { src?: string }>(({ src }, _ref) => {
        useEffect(() => { playerMounts++; }, []);
        return <div data-testid="player" data-src={src} />;
    }),
    SEO: () => null,
    GoogleAd: () => null,
    AddToChromeButton: () => null,
}));

const { default: ShareView } = await import('../ShareView');
const ID = '11111111-1111-4111-8111-111111111111';
const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    playerMounts = 0;
    URL.createObjectURL = vi.fn(() => 'blob:local-capture');
    // The server has no row for this capture: 404, after a realistic round trip.
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
        const url = String(input);
        setTimeout(() => resolve(url.includes('/recordings/')
            ? new Response('{"message":"not found"}', { status: 404 })
            : new Response(new Blob(['webm']))), 150);
    })) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); });

describe('a fresh capture the server has no row for', () => {
    it('keeps the player on screen through two minutes of polling', async () => {
        const client = new QueryClient();
        window.history.pushState({}, '', '/v?fresh=true');
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/v?fresh=true']}>
                    <Routes><Route path="/v" element={<ShareView />} /></Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        );
        // The extension hands the capture over; the page now polls for its row.
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: EXTENSION,
                source: { postMessage: vi.fn() } as unknown as Window,
                data: { type: 'SNAPREC_VIDEO_DATA', blob: new Blob(['webm'], { type: 'video/webm' }), id: ID },
            }));
        });

        let spinnerSeen = 0;
        for (let t = 0; t < 120_000; t += 100) {
            await act(async () => { await vi.advanceTimersByTimeAsync(100); });
            if (screen.queryByText(/Preparing your recording/)) spinnerSeen++;
        }

        // It really was polling the whole time.
        const polls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
            .filter(([u]) => String(u).includes(`/recordings/${ID}`)).length;
        expect(polls).toBeGreaterThan(20);

        expect(screen.getByTestId('player')).toHaveAttribute('data-src', 'blob:local-capture');
        expect(spinnerSeen).toBe(0);
        expect(playerMounts).toBe(1);
    });

    it('a share link the server does not know: one loader, then a steady "not found"', async () => {
        const client = new QueryClient();
        window.history.pushState({}, '', `/v/${ID}`);
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={[`/v/${ID}`]}>
                    <Routes><Route path="/v/:id" element={<ShareView />} /></Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        // The genuine first load still shows the loader.
        expect(screen.getByText(/Preparing your recording/)).toBeInTheDocument();

        let flips = 0;
        let last = '';
        for (let t = 0; t < 60_000; t += 100) {
            await act(async () => { await vi.advanceTimersByTimeAsync(100); });
            const now = screen.queryByText(/Preparing your recording/) ? 'loader' : screen.queryByText('Recording not found') ? 'not found' : 'other';
            if (now !== last) { flips++; last = now; }
        }
        expect(last).toBe('not found');
        expect(flips).toBe(2);   // loader -> not found, and never back
    });
});
