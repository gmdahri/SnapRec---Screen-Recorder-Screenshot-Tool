import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { forwardRef } from 'react';

/** "Copy link" on a fresh capture copied /v?fresh=true.
 *
 * The extension registers a streamed recording itself, under the id it hands
 * this page. The page finds that row by polling and says "link ready" — but it
 * stayed at /v?fresh=true, and Copy link copied window.location.href, a URL
 * with no recording in it. The shareable page is /v/<id>.
 *
 * Real: ShareView, useRecording and React Query. Mocked: the network, auth,
 * notifications, analytics, the player. */

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
    VideoPlayer: forwardRef<unknown, { src?: string }>(({ src }, _ref) => <div data-testid="player" data-src={src} />),
    SEO: () => null,
    GoogleAd: () => null,
    AddToChromeButton: () => null,
}));

const { default: ShareView } = await import('../ShareView');
const ID = '11111111-1111-4111-8111-111111111111';
const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

/** What GET /recordings/:id answers: the registered row, or 404. */
let registered: boolean;
let lookupDelayMs: number;
let copied: string[];

const row = () => ({
    id: ID, title: 'Video Recording', fileUrl: `https://r2.test/video-${ID}.webm?X-Amz-Signature=x`,
    type: 'video', isReady: true, duration: 1844, views: 0, createdAt: '2026-10-11T18:44:00.000Z',
    reactions: [], comments: [],
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    registered = true;
    lookupDelayMs = 150;
    copied = [];
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn(async (t: string) => { copied.push(t); }) },
    });
    URL.createObjectURL = vi.fn(() => 'blob:local-capture');
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
        const url = String(input);
        setTimeout(() => resolve(url.includes(`/recordings/${ID}`)
            ? (registered ? new Response(JSON.stringify(row()), { status: 200 }) : new Response('{"message":"not found"}', { status: 404 }))
            : new Response(new Blob(['webm']))), lookupDelayMs);
    })) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function openFreshCapture() {
    window.history.pushState({}, '', '/v?fresh=true');
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={['/v?fresh=true']}>
                <Routes><Route path="/v/:id?" element={<ShareView />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
    await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
            origin: EXTENSION,
            source: { postMessage: vi.fn() } as unknown as Window,
            data: { type: 'SNAPREC_VIDEO_DATA', blob: new Blob(['webm'], { type: 'video/webm' }), id: ID },
        }));
    });
}

const settle = (ms = 400) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const primary = () => screen.getByRole('button', { name: /copy link|generate shareable link|checking|waiting/i });

describe('a capture the extension registered', () => {
    it('Copy link copies /v/<id>, never /v?fresh=true', async () => {
        await openFreshCapture();
        await settle();
        expect(primary().textContent).toMatch(/copy link/i);
        fireEvent.click(primary());
        await settle(0);
        expect(copied).toEqual([`${window.location.origin}/v/${ID}`]);
    });

    it('the address becomes /v/<id> without a reload, and the page stays as it is', async () => {
        await openFreshCapture();
        await settle();
        expect(window.location.pathname).toBe(`/v/${ID}`);
        expect(window.location.search).toBe('');
        // Still the fresh capture, still playing the local copy.
        expect(screen.getByTestId('player')).toHaveAttribute('data-src', 'blob:local-capture');
        expect(screen.getByText(/link ready/i)).toBeInTheDocument();
    });
});

describe('before the page knows whether the row exists', () => {
    it('the button is disabled and says why', async () => {
        lookupDelayMs = 5_000;
        await openFreshCapture();
        await settle(100);
        expect(primary()).toBeDisabled();
        expect(primary().textContent).toMatch(/checking for your link/i);
        expect(copied).toEqual([]);
    });
});

describe('a capture that was never registered (no streamed upload, or upload/complete refused it)', () => {
    it('offers to generate a link, never a copy of a dead one', async () => {
        registered = false;
        await openFreshCapture();
        // A 404 is retried once before the page knows there is no row.
        await settle(3_000);
        expect(primary().textContent).toMatch(/generate shareable link/i);
        expect(primary()).not.toBeDisabled();
        expect(screen.queryByRole('button', { name: /^copy link$/i })).toBeNull();
        expect(window.location.search).toBe('?fresh=true');
    });

    it('offers Download, saving the local copy straight from memory, no account needed', async () => {
        registered = false;
        await openFreshCapture();
        await settle();
        const clicks: HTMLAnchorElement[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this); });
        fireEvent.click(screen.getByRole('button', { name: /download/i }));
        expect(clicks).toHaveLength(1);
        expect(clicks[0].href).toBe('blob:local-capture');
        expect(clicks[0].download).toMatch(/\.webm$/);
        expect(screen.queryByText(/sign in required/i)).toBeNull();
    });
});
