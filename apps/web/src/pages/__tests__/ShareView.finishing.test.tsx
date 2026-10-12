import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { forwardRef } from 'react';

/** A new recording's page while its upload finishes in the background.
 *
 * The extension now opens this page the moment the recording stops (with the
 * recording's id in the URL, r=) and keeps uploading. The page plays the
 * recording from the device, shows the upload's progress, says when it is
 * slow, failed, or never arrived — never spinning for ever — and accepts
 * messages only about the recording it was opened for.
 *
 * Real: ShareView, useRecording, React Query, the handoff reader. Mocked: the
 * network, auth, notifications, analytics, the player. Timers and the clock
 * are faked. */

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
const ID = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const MB = 1024 * 1024;

let registered: boolean;
let copied: string[];

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    registered = false;
    copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async (t: string) => { copied.push(t); }) } });
    URL.createObjectURL = vi.fn(() => 'blob:local-capture');
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
        const url = String(input);
        setTimeout(() => resolve(url.includes(`/recordings/${ID}`)
            ? (registered
                ? new Response(JSON.stringify({ id: ID, title: 'Video Recording', fileUrl: 'x', type: 'video', isReady: true, duration: 10, views: 0, createdAt: new Date().toISOString(), reactions: [], comments: [] }), { status: 200 })
                : new Response('{"message":"not found"}', { status: 404 }))
            : new Response(new Blob(['webm']))), 100);
    })) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function open(query = `?fresh=true&r=${ID}`) {
    window.history.pushState({}, '', `/v${query}`);
    render(
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={[`/v${query}`]}>
                <Routes><Route path="/v/:id?" element={<ShareView />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

const fromExtension = (data: object) => act(async () => {
    window.dispatchEvent(new MessageEvent('message', {
        origin: EXTENSION, source: { postMessage: vi.fn() } as unknown as Window, data,
    }));
});
const deliver = (id = ID) => fromExtension({ type: 'SNAPREC_VIDEO_DATA', blob: new Blob(['webm'], { type: 'video/webm' }), id });
const progress = (p: object, id = ID) => fromExtension({ type: 'SNAPREC_UPLOAD_PROGRESS', id, ...p });
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const primary = () => screen.getByRole('button', { name: /copy link|generate shareable link|checking|waiting|finishing upload/i });

describe('only the recording this tab was opened for', () => {
    it('ignores a recording, and reports, for another id', async () => {
        open();
        await deliver(OTHER);
        await progress({ state: 'uploading', uploadedBytes: 1, totalBytes: 2 }, OTHER);
        await pass(200);
        expect(screen.queryByTestId('player')?.getAttribute('data-src') ?? null).not.toBe('blob:local-capture');
        expect(screen.queryByText(/Finishing your recording/)).toBeNull();
    });
});

describe('from the wrong origin', () => {
    it('a website frame cannot hand the page a recording or a status', async () => {
        open();
        const fromSite = (data: object) => act(async () => {
            window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', source: { postMessage: vi.fn() } as unknown as Window, data }));
        });
        await fromSite({ type: 'SNAPREC_VIDEO_DATA', blob: new Blob(['x'], { type: 'video/webm' }), id: ID });
        await fromSite({ type: 'SNAPREC_UPLOAD_PROGRESS', id: ID, state: 'registered' });
        await fromSite({ type: 'SNAPREC_HANDOFF_PENDING', id: ID });
        await pass(200);
        expect(screen.queryByTestId('player')?.getAttribute('data-src') ?? null).not.toBe('blob:local-capture');
        expect(screen.queryByTestId('capture-notice')).toBeNull();
    });
});

describe('while the upload finishes', () => {
    it('plays the recording here and shows the upload, with no way to start a second upload', async () => {
        open();
        await deliver();
        await progress({ state: 'uploading', uploadedBytes: 120 * MB, totalBytes: 184 * MB });
        await pass(500);
        expect(screen.getByTestId('player')).toHaveAttribute('data-src', 'blob:local-capture');
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/uploading 120 of 184 MB/);
        expect(primary()).toBeDisabled();
        expect(primary().textContent).toMatch(/finishing upload/i);
        expect(screen.queryByRole('button', { name: /generate shareable link/i })).toBeNull();
    });

    it('says "uploading slowly" after 15 s of low throughput', async () => {
        open();
        await deliver();
        for (let s = 0; s <= 20; s++) {
            await progress({ state: 'uploading', uploadedBytes: s * 40_000, totalBytes: 184 * MB });   // 0.3 Mbit/s
            await pass(1000);
        }
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/Uploading slowly/);
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/safe on this device/);
    });

    it('a fast upload is never called slow', async () => {
        open();
        await deliver();
        for (let s = 0; s <= 20; s++) {
            await progress({ state: 'uploading', uploadedBytes: s * MB, totalBytes: 184 * MB });       // 8 Mbit/s
            await pass(1000);
        }
        expect(screen.getByTestId('capture-notice').textContent).not.toMatch(/slowly/);
    });

    it('registered: the page finds the row and offers the canonical link', async () => {
        open();
        await deliver();
        await progress({ state: 'uploading', uploadedBytes: 5, totalBytes: 10 });
        await pass(3000);
        registered = true;
        await progress({ state: 'registered' });
        await pass(3500);
        expect(primary().textContent).toMatch(/copy link/i);
        fireEvent.click(primary());
        await pass(0);
        expect(copied).toEqual([`${window.location.origin}/v/${ID}`]);
    });
});

describe('when it fails', () => {
    it('says why, and offers Download and Generate shareable link', async () => {
        open();
        await deliver();
        await progress({ state: 'failed', reason: 'stalled' });
        await pass(200);
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/Couldn.t finish uploading/);
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/stopped moving/);
        expect(primary().textContent).toMatch(/generate shareable link/i);
        expect(primary()).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    it('a failed save on the extension\'s side is told, and Download is still there', async () => {
        open();
        await deliver();
        await fromExtension({ type: 'SNAPREC_LOCAL_SAVE', id: ID, ok: false });
        await pass(200);
        expect(screen.getByText(/isn.t stored on this device yet/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });
});

describe('a recording that never arrives', () => {
    it('after 15 s with no word from the extension, says so instead of waiting for ever', async () => {
        open();
        await pass(14_000);
        expect(screen.queryByRole('alert')).toBeNull();
        await pass(1_500);
        expect(screen.getByRole('alert').textContent).toMatch(/didn.t reach this page/);
        expect(screen.getByRole('alert').textContent).toMatch(/Downloads/);
    });

    it('a slow machine is not failed while the frame keeps saying the recording is coming', async () => {
        open();
        for (let s = 0; s < 40; s++) {
            await fromExtension({ type: 'SNAPREC_HANDOFF_PENDING', id: ID });
            await pass(1000);
        }
        expect(screen.queryByText(/didn.t reach this page/)).toBeNull();
        await deliver();
        await pass(200);
        expect(screen.getByTestId('player')).toHaveAttribute('data-src', 'blob:local-capture');
    });

    it('an older extension, which opens the page without an id, is never timed out', async () => {
        open('?fresh=true');
        await pass(60_000);
        expect(screen.queryByText(/didn.t reach this page/)).toBeNull();
    });
});

describe('when the extension goes quiet', () => {
    /* While its upload is unsettled the extension repeats its last report
     * every 10 s. Silence after that means it is gone — the browser closed
     * its document, or this page was reloaded and no longer hears it — and
     * the page must not sit on "Finishing upload…" for ever. */
    it('after 45 s with no report, the upload counts as failed and a link can be generated', async () => {
        open();
        await deliver();
        await progress({ state: 'uploading', uploadedBytes: 5 * MB, totalBytes: 10 * MB });
        await pass(44_000);
        expect(primary().textContent).toMatch(/finishing upload/i);
        await pass(2_000);
        expect(screen.getByTestId('capture-notice').textContent).toMatch(/stopped reporting/);
        expect(primary().textContent).toMatch(/generate shareable link/i);
        expect(primary()).toBeEnabled();
    });

    it('a page that has the recording but never hears about its upload (a reload) does not wait for ever', async () => {
        open();
        await deliver();
        await pass(46_000);
        expect(primary().textContent).toMatch(/generate shareable link/i);
    });

    it('an upload that keeps reporting, even with no new bytes, is still finishing', async () => {
        open();
        await deliver();
        for (let s = 0; s < 12; s++) {
            await progress({ state: 'completing', uploadedBytes: 10 * MB, totalBytes: 10 * MB });
            await pass(10_000);
        }
        expect(primary().textContent).toMatch(/finishing upload/i);
    });

    it('a report after the silence takes over again', async () => {
        open();
        await deliver();
        await pass(46_000);
        registered = true;
        await progress({ state: 'registered' });
        await pass(4_000);
        expect(primary().textContent).toMatch(/copy link/i);
    });
});
