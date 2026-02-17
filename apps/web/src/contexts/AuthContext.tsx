import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useClaimRecordings } from '../hooks/useRecordings';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    guestId: string | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
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
        signOut
    }), [user, session, guestId, loading, signInWithGoogle, signOut]);

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
