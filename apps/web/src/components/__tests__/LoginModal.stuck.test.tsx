import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** "Sign in Required" stuck on "Loading..." forever.
 *
 * The Google button was disabled while AuthContext's `loading` was true, and
 * `loading` means "the saved session is still being restored". Supabase
 * restores it inside a lock shared by every tab, so the restore can:
 *  - fail: another tab held the lock past its 10 s timeout. getSession then
 *    rejects, which nothing caught, so `loading` never went false — and the
 *    failed start is cached by the client, so every auth call fails until
 *    the page is reloaded;
 *  - hang: its token refresh has no timeout.
 * Either way the only way forward was a disabled button.
 *
 * Real: AuthProvider, LoginModal, GoogleSignInButton. Mocked: the Supabase
 * client (the boundary) and analytics. */

const supabaseAuth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOAuth: vi.fn(),
};
let authListener: ((event: string, session: unknown) => void) | null = null;

vi.mock('../../lib/supabase', () => ({ supabase: { auth: supabaseAuth } }));
vi.mock('../../lib/analytics', () => ({ capture: vi.fn() }));

const never = () => new Promise<never>(() => {});

async function renderModal() {
    const { AuthProvider, useAuth } = await import('../../contexts/AuthContext');
    const { LoginModal } = await import('../LoginModal');
    const Probe = () => {
        const { loading, user } = useAuth();
        return <span data-testid="auth">{loading ? 'restoring' : user ? 'signed-in' : 'signed-out'}</span>;
    };
    render(
        <QueryClientProvider client={new QueryClient()}>
            <AuthProvider>
                <Probe />
                <LoginModal isOpen onClose={() => {}} actionDescription="generate a shareable link" />
            </AuthProvider>
        </QueryClientProvider>,
    );
}

const googleButton = () => screen.getByRole('button', { name: /google/i });
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
    vi.useFakeTimers();
    authListener = null;
    supabaseAuth.onAuthStateChange.mockImplementation((cb) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
    });
    supabaseAuth.getSession.mockReset();
    supabaseAuth.signInWithOAuth.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('restoring the saved session', () => {
    it('a restore that fails (lock timeout) ends in signed-out, not "restoring" forever', async () => {
        supabaseAuth.getSession.mockRejectedValue(Object.assign(new Error('Acquiring an exclusive Navigator LockManager lock timed out'), { isAcquireTimeout: true }));
        await renderModal();
        await flush();
        expect(screen.getByTestId('auth').textContent).toBe('signed-out');
    });

    it('a restore that hangs gives up waiting after 10 s', async () => {
        supabaseAuth.getSession.mockReturnValue(never());
        await renderModal();
        await act(async () => { vi.advanceTimersByTime(9_999); });
        expect(screen.getByTestId('auth').textContent).toBe('restoring');
        await act(async () => { vi.advanceTimersByTime(1); });
        expect(screen.getByTestId('auth').textContent).toBe('signed-out');
    });

    it('a session that turns up after that still signs the user in', async () => {
        supabaseAuth.getSession.mockReturnValue(never());
        await renderModal();
        await act(async () => { vi.advanceTimersByTime(10_000); });
        await act(async () => { authListener?.('INITIAL_SESSION', { user: { id: 'sb-1' } }); });
        expect(screen.getByTestId('auth').textContent).toBe('signed-in');
    });

    it('a restore that succeeds is unchanged', async () => {
        supabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
        await renderModal();
        await flush();
        expect(screen.getByTestId('auth').textContent).toBe('signed-out');
    });
});

describe('the Google button in "Sign in Required"', () => {
    it('can be pressed while the saved session is still being restored', async () => {
        supabaseAuth.getSession.mockReturnValue(never());
        await renderModal();
        expect(googleButton()).not.toBeDisabled();
        expect(googleButton().textContent).toMatch(/continue with google/i);
    });

    it('starts Google sign-in, returning here afterwards', async () => {
        supabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
        supabaseAuth.signInWithOAuth.mockReturnValue(never());   // the browser is navigating away
        await renderModal();
        await flush();
        fireEvent.click(googleButton());
        await flush();
        expect(supabaseAuth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'google',
            options: expect.objectContaining({ redirectTo: `${window.location.origin}/auth/callback` }),
        }));
        expect(googleButton()).toBeDisabled();
        expect(googleButton().textContent).toMatch(/opening google/i);
    });

    it('when sign-in cannot start, says so and offers a reload', async () => {
        supabaseAuth.getSession.mockRejectedValue(new Error('lock timed out'));
        supabaseAuth.signInWithOAuth.mockRejectedValue(new Error('lock timed out'));
        await renderModal();
        await flush();
        fireEvent.click(googleButton());
        await flush();
        expect(screen.getByRole('alert').textContent).toMatch(/couldn.t start sign-in/i);
        expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
        expect(googleButton()).not.toBeDisabled();
    });

    it('an error Supabase returns is handled the same way', async () => {
        supabaseAuth.getSession.mockResolvedValue({ data: { session: null } });
        supabaseAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('provider is not enabled') });
        await renderModal();
        await flush();
        fireEvent.click(googleButton());
        await flush();
        expect(screen.getByRole('alert').textContent).toMatch(/couldn.t start sign-in/i);
    });

    it('when nothing happens for 15 s, says so instead of waiting forever', async () => {
        supabaseAuth.getSession.mockReturnValue(never());
        supabaseAuth.signInWithOAuth.mockReturnValue(never());
        await renderModal();
        fireEvent.click(googleButton());
        await act(async () => { vi.advanceTimersByTime(14_999); });
        expect(screen.queryByRole('alert')).toBeNull();
        await act(async () => { vi.advanceTimersByTime(1); });
        expect(screen.getByRole('alert').textContent).toMatch(/couldn.t start sign-in/i);
        expect(googleButton()).not.toBeDisabled();
    });
});
