import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { forwardRef, useSyncExternalStore } from 'react';
import { SessionExpiredError } from '../../lib/sessionExpired';

/** The share page when a comment or a reaction is refused because the
 * session lapsed (the API's 401).
 *
 * Same prompt as an upload: "Your session expired", the stale session
 * cleared, and a comment's words kept. Real: ShareView, the composer,
 * LoginModal, SessionExpiredError. Mocked: network, auth, notifications,
 * analytics and the media element. */

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
const addComment = vi.fn();
const addReaction = vi.fn();
let currentRecording: unknown = undefined;
const recordingCalls: unknown[][] = [];
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
        useRecording: (...args: unknown[]) => { recordingCalls.push(args); return { data: currentRecording, isLoading: false }; },
        useUpdateRecording: mutation, useResolveComment: mutation, useClaimRecordings: mutation,
        // react-query's mutate(vars, { onSuccess, onError }) over a promise.
        useAddComment: () => ({
            mutateAsync: addComment,
            mutate: (vars: unknown, cb?: { onSuccess?: () => void; onError?: (e: unknown) => void }) =>
                addComment(vars).then(() => cb?.onSuccess?.(), (e: unknown) => cb?.onError?.(e)),
            isPending: false,
        }),
        useAddReaction: () => ({
            mutate: (vars: unknown, cb?: { onError?: (e: unknown) => void }) =>
                addReaction(vars).then(undefined, (e: unknown) => cb?.onError?.(e)),
        }),
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

const ID = '11111111-1111-4111-8111-111111111111';
const recording = (over: Record<string, unknown> = {}) => ({
    id: ID, title: 'Quarterly review', fileUrl: 'https://r2.test/v.webm', type: 'video', isReady: true,
    createdAt: '2026-10-01T00:00:00Z', views: 3, duration: 60, reactions: [], comments: [],
    user: { fullName: 'Owner Person', avatarUrl: null }, viewerIsOwner: false, ...over,
});

function open(path: string) {
    // ShareView reads ?fresh from window.location, which MemoryRouter does not set.
    window.history.pushState({}, '', path);
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="/v" element={<ShareView />} /><Route path="/v/:id" element={<ShareView />} /></Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    addComment.mockReset();
    addReaction.mockReset();
    localStorage.clear();
    auth.set({ id: 'sb-1', user_metadata: {} });
});

describe('a comment refused because the session expired', () => {
    it('prompts to sign in again, clears the stale session, and keeps the words', async () => {
        currentRecording = recording();
        addComment.mockRejectedValue(new SessionExpiredError());
        open(`/v/${ID}`);

        await userEvent.type(await screen.findByLabelText('Write a comment'), 'Is this the final cut?');
        await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

        expect(await screen.findByText('Your session expired')).toBeInTheDocument();
        expect(screen.getByText(/sign in again to post a comment/i)).toBeInTheDocument();
        await waitFor(() => expect(auth.expireSession).toHaveBeenCalledTimes(1));
        expect(notify).toHaveBeenCalledWith(expect.stringMatching(/session expired.*sign in again/i), 'error');
        expect(screen.getByLabelText('Write a comment')).toHaveValue('Is this the final cut?');
        expect(addComment).toHaveBeenCalledTimes(1);          // not retried as a guest
    });

    it('an ordinary failure keeps the words and says so, without a sign-in prompt', async () => {
        currentRecording = recording();
        addComment.mockRejectedValue(new Error('API Error: 500'));
        open(`/v/${ID}`);
        await userEvent.type(await screen.findByLabelText('Write a comment'), 'hello');
        await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

        await waitFor(() => expect(notify).toHaveBeenCalledWith('Could not post your comment. Please try again.', 'error'));
        expect(screen.getByLabelText('Write a comment')).toHaveValue('hello');
        expect(auth.expireSession).not.toHaveBeenCalled();
        expect(screen.queryByText('Your session expired')).not.toBeInTheDocument();
    });

    it('a comment that goes through clears the box', async () => {
        currentRecording = recording();
        addComment.mockResolvedValue({ id: 'c1' });
        open(`/v/${ID}`);
        await userEvent.type(await screen.findByLabelText('Write a comment'), 'hello');
        await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
        await waitFor(() => expect(screen.getByLabelText('Write a comment')).toHaveValue(''));
    });
});

describe('a reaction refused because the session expired', () => {
    it('prompts to sign in again and clears the stale session', async () => {
        // The reaction bar lives only in the legacy layout, which a URL with
        // an id reaches for a screenshot opened as ?fresh=true; without an id
        // in the URL handleReaction does nothing at all.
        currentRecording = recording({ type: 'screenshot', fileUrl: 'https://r2.test/s.png' });
        addReaction.mockRejectedValue(new SessionExpiredError());
        open(`/v/${ID}?fresh=true`);

        fireEvent.click((await screen.findByText('thumb_up')).closest('button')!);

        expect(await screen.findByText('Your session expired')).toBeInTheDocument();
        expect(screen.getByText(/sign in again to react with "like"/i)).toBeInTheDocument();
        await waitFor(() => expect(auth.expireSession).toHaveBeenCalledTimes(1));
        expect(addReaction).toHaveBeenCalledTimes(1);
    });
});

/** GET /recordings/:id answers per viewer, so the page asks for — and caches —
 * the copy that belongs to whoever is signed in, and a different one once
 * they are not. */
describe('whose copy of the recording the page asks for', () => {
    it('the signed-in viewer’s, then the anonymous one after the session is cleared', async () => {
        currentRecording = recording({ viewerIsOwner: true });
        recordingCalls.length = 0;
        open(`/v/${ID}`);
        await screen.findByLabelText('Write a comment');
        expect(recordingCalls.at(-1)?.[2]).toMatchObject({ viewer: 'sb-1' });

        await act(async () => { auth.set(null); });
        expect(recordingCalls.at(-1)?.[2]).toMatchObject({ viewer: null });
    });
});
