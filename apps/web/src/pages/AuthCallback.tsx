import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../lib/supabase';
import { fetchWithAuth } from '../hooks/useRecordings';
import { useAuth } from '../contexts/AuthContext';
import { decodeReturnTo } from '../lib/returnTo';
import { SignInFailed, type SignInFailure } from './Login/SignInFailed';

/** Supabase's error surface is not stable across versions, so this maps
 * defensively. Anything unrecognised falls through to `networkDropped`, whose
 * copy — "check your connection and try again, nothing was sent" — is the only
 * one true regardless of cause. */
function classify(errorCode: string | null, description: string | null): SignInFailure {
    const text = `${errorCode ?? ''} ${description ?? ''}`.toLowerCase();

    if (text.includes('expired') || text.includes('already been used') || text.includes('otp_expired')) {
        return 'linkUsed';
    }
    if (text.includes('pkce') || text.includes('code verifier') || text.includes('flow_state')) {
        // The verifier lives in the browser that requested the link, so its
        // absence means the link was opened somewhere else.
        return 'wrongBrowser';
    }
    if (text.includes('access_denied') || text.includes('admin') || text.includes('not approved')) {
        return 'adminBlocked';
    }
    return 'networkDropped';
}

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const { signInWithGoogle } = useAuth();
    const [failure, setFailure] = useState<SignInFailure | null>(null);
    const hasRun = React.useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const handleCallback = async () => {
            // Supabase returns failures in the hash fragment, not the query.
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const query = new URLSearchParams(window.location.search);
            const errorCode = hash.get('error_code') ?? hash.get('error') ?? query.get('error');
            const description = hash.get('error_description') ?? query.get('error_description');

            if (errorCode) {
                setFailure(classify(errorCode, description));
                return;
            }

            const { data, error } = await supabase.auth.getSession();

            if (error) {
                setFailure(classify(error.name, error.message));
                return;
            }

            if (!data.session) {
                setFailure('networkDropped');
                return;
            }

            try {
                // Ensures the user exists in public.sr_users and fires the
                // welcome email if they are new.
                await fetchWithAuth('/users/sync', { method: 'POST' });
            } catch (syncError) {
                // A failed sync must not strand a signed-in user on this page.
                console.error('AuthCallback: user sync failed', syncError);
            }

            const stored = localStorage.getItem('auth_return_path');
            localStorage.removeItem('auth_return_path');
            navigate(decodeReturnTo(query.get('returnTo') ?? stored), { replace: true });
        };

        handleCallback();
    }, [navigate]);

    if (failure) {
        return (
            <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased flex justify-center px-6 py-16">
                <Helmet><title>Sign-in problem — SnapRec</title></Helmet>
                <SignInFailed
                    kind={failure}
                    onRetry={() => navigate('/login', { replace: true })}
                    onGoogle={signInWithGoogle}
                    onEmailInstead={() => navigate('/login', { replace: true })}
                    onApprovalLink={() => navigate('/contact')}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--sr-surface-panel-light)] flex items-center justify-center">
            <Helmet><title>Signing you in — SnapRec</title></Helmet>
            <span
                role="status"
                aria-live="polite"
                className="font-mono text-[11px] text-[var(--sr-text-faint-on-light)]"
            >
                Signing you in…
            </span>
        </div>
    );
};

export default AuthCallback;
