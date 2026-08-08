import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LandingNavbar, SEO } from '../components';
import { SignInPanel } from './Login/SignInPanel';
import { decodeReturnTo } from '../lib/returnTo';

const Login: React.FC = () => {
    const { user, loading, signInWithGoogle, signInWithMagicLink } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [sent, setSent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;

    // Where to land afterwards. The query param wins because it survives the
    // OAuth round trip, which router state does not.
    const returnTo = searchParams.get('returnTo')
        ? decodeReturnTo(searchParams.get('returnTo'))
        : from?.pathname && from.pathname !== '/login'
            ? `${from.pathname}${from.search ?? ''}`
            : '/home';

    useEffect(() => {
        if (returnTo !== '/home') localStorage.setItem('auth_return_path', returnTo);
    }, [returnTo]);

    useEffect(() => {
        if (user && !loading) navigate(returnTo, { replace: true });
    }, [user, loading, navigate, returnTo]);

    const onMagicLink = async (email: string) => {
        setError(null);
        const failure = await signInWithMagicLink(email);
        if (failure) setError(failure);
        else setSent(email);
    };

    return (
        <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
            <SEO
                url="/login"
                title="Sign in — SnapRec"
                description="Sign in to keep your captures in one library, rename links and see who watched."
                noIndex
            />
            <LandingNavbar />

            <main className="flex justify-center px-6 py-16">
                <div className="w-full max-w-[440px] bg-[var(--sr-surface-paper)] border border-[var(--sr-border-light-soft)] p-7">
                    {sent ? (
                        <div className="flex flex-col gap-2.5">
                            <h1 className="text-[20px] font-semibold tracking-[-0.02em] m-0">
                                Check your inbox
                            </h1>
                            <p className="text-[13.5px] leading-relaxed text-[var(--sr-text-muted-on-light)] m-0">
                                We sent a one-time link to <strong className="font-semibold">{sent}</strong>.
                                It works once and expires after 15 minutes.
                            </p>
                            <button
                                type="button"
                                onClick={() => setSent(null)}
                                className="self-start h-[var(--sr-h-2xs)] px-3.5 border border-[var(--sr-border-light)] text-[12.5px] rounded-[2px] mt-1"
                            >
                                Use a different address
                            </button>
                        </div>
                    ) : (
                        <>
                            <SignInPanel
                                onGoogle={signInWithGoogle}
                                onMagicLink={onMagicLink}
                            />
                            {error && (
                                <p role="alert" className="mt-3 text-[12px] text-[var(--sr-coral-hover)]">
                                    {error}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Login;
