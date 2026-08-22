import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useClaimRecordings } from '../hooks/useRecordings';
// Analytics: tracking only — no auth behaviour is changed here.
import { capture } from '../lib/analytics';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    guestId: string | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    /** Passwordless one-time link. Resolves with an error message, or null on
     * success — the caller shows it inline rather than a thrown exception. */
    signInWithMagicLink: (email: string) => Promise<string | null>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

/* Analytics: which method started a sign-in cannot be read from the auth event
 * that completes it, and both methods leave the page before completing. The
 * choice is therefore stashed the same way auth_return_path already is, and
 * read back once on SIGNED_IN.
 *
 * Timestamped and short-lived: a magic link opened days later, or in a
 * different browser, must not attribute that sign-in to a stale intent. */
const AUTH_METHOD_KEY = 'snaprec_auth_method';
const AUTH_METHOD_TTL_MS = 60 * 60 * 1000;

function rememberAuthMethod(method: 'google' | 'magic_link') {
    try {
        localStorage.setItem(AUTH_METHOD_KEY, JSON.stringify({ method, at: Date.now() }));
    } catch { /* storage unavailable — falls back to 'unknown' */ }
}

function takeAuthMethod(): 'google' | 'magic_link' | 'unknown' {
    try {
        const raw = localStorage.getItem(AUTH_METHOD_KEY);
        localStorage.removeItem(AUTH_METHOD_KEY);
        if (!raw) return 'unknown';
        const { method, at } = JSON.parse(raw);
        if (Date.now() - at > AUTH_METHOD_TTL_MS) return 'unknown';
        return method === 'google' || method === 'magic_link' ? method : 'unknown';
    } catch {
        return 'unknown';
    }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [guestId, setGuestId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const claimMutation = useClaimRecordings();
    const hasClaimedRef = useRef(false);

    useEffect(() => {
        // Handle guest identity
        let id = localStorage.getItem('guestId');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('guestId', id);
        }
        setGuestId(id);
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Analytics: SIGNED_IN already carries the meaning "a genuine new
                // sign-in" in this file — the claim below relies on it — so a
                // restored session on page load does not fire this.
                if (event === 'SIGNED_IN' && session?.user) {
                    capture('auth_completed', { method: takeAuthMethod() });
                }

                // Only claim guest recordings on explicit SIGNED_IN event (not TOKEN_REFRESHED)
                // Also only claim once per session
                if (event === 'SIGNED_IN' && session?.user && !hasClaimedRef.current) {
                    const guestIds = JSON.parse(localStorage.getItem('guestRecordingIds') || '[]');
                    if (guestIds.length > 0) {
                        hasClaimedRef.current = true;
                        console.log('Claiming guest recordings:', guestIds);
                        claimMutation.mutate(guestIds, {
                            onSuccess: () => {
                                localStorage.removeItem('guestRecordingIds');
                                console.log('Guest recordings claimed successfully');
                            },
                            onError: (err) => {
                                hasClaimedRef.current = false; // Allow retry
                                console.error('Failed to claim guest recordings:', err);
                            },
                        });
                    }
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []); // Stability: removing claimMutation dependency to avoid re-subscribing on every render

    const signInWithGoogle = useCallback(async () => {
        hasClaimedRef.current = false;
        const currentPath = window.location.pathname + window.location.search;
        const redirectTo = `${window.location.origin}/auth/callback`;
        console.log('SignIn: Storing return path:', currentPath);
        localStorage.setItem('auth_return_path', currentPath);
        rememberAuthMethod('google');
        capture('auth_google_started', {});

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo,
                skipBrowserRedirect: false
            },
        });
        if (error) {
            console.error('Error signing in with Google:', error);
        }
    }, []);

    const signInWithMagicLink = useCallback(async (email: string) => {
        hasClaimedRef.current = false;
        const currentPath = window.location.pathname + window.location.search;
        localStorage.setItem('auth_return_path', currentPath);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });

        // Analytics: only when Supabase accepted the send. An error here means
        // no email went out, so counting it as sent would overstate the funnel.
        if (!error) {
            rememberAuthMethod('magic_link');
            capture('auth_magic_link_sent', {});
        }

        // Returned rather than thrown: the sign-in panel renders it beside the
        // field, and an uncaught rejection here would blank the page the user
        // was trying to get back to.
        return error ? error.message : null;
    }, []);

    const signOut = useCallback(async () => {
        hasClaimedRef.current = false;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
    }, []);

    const value = useMemo(() => ({
        user,
        session,
        guestId,
        loading,
        signInWithGoogle,
        signInWithMagicLink,
        signOut
    }), [user, session, guestId, loading, signInWithGoogle, signInWithMagicLink, signOut]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
