import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionDescription?: string;
    /** The session lapsed mid-task, rather than never existing. Says so, and
     * says the work is safe, instead of a generic "Sign in Required". */
    sessionExpired?: boolean;
}

/** How long "Opening Google…" may last before the modal says sign-in did not
 * start. A working sign-in has left the page well before this. */
export const SIGN_IN_START_TIMEOUT_MS = 15_000;

export const LoginModal: React.FC<LoginModalProps> = ({
    isOpen,
    onClose,
    actionDescription = 'continue',
    sessionExpired = false,
}) => {
    const { signInWithGoogle } = useAuth();
    // Disabled only while this click is in flight. It used to follow the
    // auth context's `loading` (the saved session being restored), which can
    // hang or fail and left the button on "Loading..." for good.
    const [signingIn, setSigningIn] = useState(false);
    const [failed, setFailed] = useState(false);
    const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopWaiting = () => {
        if (giveUp.current) clearTimeout(giveUp.current);
        giveUp.current = null;
    };

    useEffect(() => {
        if (!isOpen) {
            stopWaiting();
            setSigningIn(false);
            setFailed(false);
        }
        return stopWaiting;
    }, [isOpen]);

    const handleSignIn = async () => {
        setFailed(false);
        setSigningIn(true);
        stopWaiting();
        // On success the browser leaves for Google. Still here this long
        // after means it never did.
        giveUp.current = setTimeout(() => {
            setSigningIn(false);
            setFailed(true);
        }, SIGN_IN_START_TIMEOUT_MS);
        const error = await signInWithGoogle();
        if (error) {
            stopWaiting();
            setSigningIn(false);
            setFailed(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                    <div className="size-16 bg-[var(--sr-cyan)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-[var(--sr-cyan-on-light)] text-3xl">lock</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--sr-text-primary-on-light)] mb-2">
                        {sessionExpired ? 'Your session expired' : 'Sign in Required'}
                    </h3>
                    <p className="text-[var(--sr-text-faint-on-light)] text-sm">
                        {sessionExpired
                            ? `Sign in again to ${actionDescription}. Your recording is still here on this device.`
                            : `Sign in with your Google account to ${actionDescription}.`}
                    </p>
                </div>
                <div className="space-y-3">
                    <GoogleSignInButton
                        onClick={handleSignIn}
                        loading={signingIn}
                        loadingLabel="Opening Google…"
                        fullWidth
                    />
                    {failed && (
                        <p role="alert" className="text-sm text-center text-[var(--sr-coral-hover)]">
                            Couldn't start sign-in. Reload the page and try again.{' '}
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="underline font-medium cursor-pointer"
                            >
                                Reload
                            </button>
                        </p>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 text-[var(--sr-text-faint-on-light)] hover:text-[var(--sr-text-primary-on-light)] font-medium text-sm transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
