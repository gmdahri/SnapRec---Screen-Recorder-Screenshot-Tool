import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { forwardRef, useSyncExternalStore } from 'react';
import { SessionExpiredError } from '../../lib/sessionExpired';

/** The share page when a signed-in upload is refused because the session
 * lapsed (the API's 401, or its "userId does not match" 403).
 *
 * Real: ShareView, the handoff gate, LoginModal, and SessionExpiredError.
 * Mocked: the network (recordings hooks), auth, notifications, analytics and
 * the media element — the boundary, not the behaviour under test. */

const auth = (() => {
    let user: { id: string; user_metadata: Record<string, unknown> } | null = { id: 'sb-1', user_metadata: {} };
    const listeners = new Set<() => void>();
    return {
        get: () => user,
        set: (u: typeof user) => { user = u; listeners.forEach((l) => l()); },
        subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
        expireSession: vi.fn(async () => { auth.set(null); }),
        signInWithGoogle: vi.fn(async () => {}),
    };
})();

const createRecording = vi.fn();
const notify = vi.fn();
const navigateSpy = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => {
        const user = useSyncExternalStore(auth.subscribe, auth.get);
        return { user, session: null, guestId: null, loading: false, expireSession: auth.expireSession, signInWithGoogle: auth.signInWithGoogle };
    },
}));
vi.mock('../../contexts/NotificationContext', () => ({ useNotification: () => ({ showNotification: notify }) }));
vi.mock('../../lib/analytics', () => ({ capture: vi.fn() }));
vi.mock('../../lib/mediaDuration', () => ({ measureMedia: async () => ({}) }));
vi.mock('../../hooks/useVideoFrames', () => ({ useVideoFrames: () => ({ frames: [], generating: false, blocked: false }) }));
vi.mock('../../hooks/useWatchProgress', () => ({ useWatchProgress: () => ({ observe: vi.fn() }) }));
vi.mock('../../hooks/useStableMediaUrl', () => ({ useStableMediaUrl: (u?: string) => u ?? null }));
vi.mock('../../hooks/useDownload', () => ({ useDownload: () => ({ download: vi.fn(), state: 'idle' }) }));
vi.mock('../../hooks/useRecordings', () => {
    const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
    return {
        // The lookup has answered: the server has no row for this capture.
        useRecording: () => ({ data: undefined, isLoading: false, isFetched: true }),
        useUpdateRecording: mutation, useResolveComment: mutation, useAddReaction: mutation,
        useAddComment: mutation, useClaimRecordings: mutation,
        useGetUploadUrl: () => ({ mutateAsync: async () => ({ uploadUrl: 'https://r2.test/put', fileUrl: 'video-new.webm' }) }),
        useCreateRecording: () => ({ mutateAsync: createRecording }),
        uploadFile: vi.fn(async () => {}),
        fetchWithAuth: vi.fn(),
    };
});
vi.mock('../../components', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../components')>()),
    VideoPlayer: forwardRef<unknown, { src?: string }>(({ src }, _ref) => <div data-testid="player" data-src={src} />),
    SEO: () => null,
    GoogleAd: () => null,
    AddToChromeButton: () => null,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigateSpy,
}));

const { default: ShareView } = await import('../ShareView');

const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

async function openFreshCaptureFromExtension() {
    render(
        <MemoryRouter initialEntries={['/v?fresh=true']}>
            <Routes><Route path="/v" element={<ShareView />} /></Routes>
        </MemoryRouter>,
    );
    // The extension's courier hands the capture over by reference.
    await act(async () => {
        window.dispatchEvent(new MessageEvent('message', {
            origin: EXTENSION,
            source: { postMessage: vi.fn() } as unknown as Window,
            data: { type: 'SNAPREC_VIDEO_DATA', blob: new Blob(['webm'], { type: 'video/webm' }), id: '11111111-1111-4111-8111-111111111111' },
        }));
    });
    return screen.findByRole('button', { name: /generate shareable link/i });
}

beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps queued *Once implementations; a test that queues more
    // than the code consumes would otherwise leak them into the next test.
    createRecording.mockReset();
    localStorage.clear();
    auth.set({ id: 'sb-1', user_metadata: {} });
    URL.createObjectURL = vi.fn(() => 'blob:local-capture');
    globalThis.fetch = vi.fn(async () => new Response(new Blob(['webm']))) as typeof fetch;
});

describe('share page: the session expires during "Generate shareable link"', () => {
    it('says the session expired, offers sign-in, and keeps the recording on the page', async () => {
        createRecording.mockRejectedValue(new SessionExpiredError());
        fireEvent.click(await openFreshCaptureFromExtension());

        // A clear message…
        await waitFor(() => expect(notify).toHaveBeenCalledWith(
            expect.stringMatching(/session expired.*sign in again.*still on this device/i), 'error'));
        // …a sign-in action that says why…
        expect(await screen.findByText('Your session expired')).toBeInTheDocument();
        expect(screen.getByText(/sign in again to generate a shareable link/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
        // …and the recording is still here: same local blob in the player, no navigation away.
        expect(screen.getByTestId('player')).toHaveAttribute('data-src', 'blob:local-capture');
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('clears the dead session and queues the same action for after sign-in — without retrying as a guest', async () => {
        createRecording.mockRejectedValue(new SessionExpiredError());
        fireEvent.click(await openFreshCaptureFromExtension());

        await waitFor(() => expect(auth.expireSession).toHaveBeenCalledTimes(1));
        expect(localStorage.getItem('share_pending_action')).toBe('share');
        // One attempt only: no guest retry, and no loop against the stale session.
        await new Promise((r) => setTimeout(r, 50));
        expect(createRecording).toHaveBeenCalledTimes(1);
        expect(createRecording.mock.calls[0][0]).toMatchObject({ userId: 'sb-1' });
    });

    it('resumes the upload once the user signs in again', async () => {
        createRecording.mockRejectedValueOnce(new SessionExpiredError())
            .mockResolvedValueOnce({ id: '22222222-2222-4222-8222-222222222222' });
        fireEvent.click(await openFreshCaptureFromExtension());
        await waitFor(() => expect(auth.expireSession).toHaveBeenCalled());

        await act(async () => { auth.set({ id: 'sb-1', user_metadata: {} }); });
        await waitFor(() => expect(createRecording).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/v/22222222-2222-4222-8222-222222222222', { replace: true }));
    });

    it('an ordinary failure is still just an error, not a sign-in prompt', async () => {
        createRecording.mockRejectedValue(new Error('API Error: 500 Internal Server Error'));
        fireEvent.click(await openFreshCaptureFromExtension());
        await waitFor(() => expect(notify).toHaveBeenCalledWith('API Error: 500 Internal Server Error', 'error'));
        expect(auth.expireSession).not.toHaveBeenCalled();
        expect(screen.queryByText('Your session expired')).not.toBeInTheDocument();
    });
});
