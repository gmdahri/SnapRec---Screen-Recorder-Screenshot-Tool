import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useClaimRecordings } from '../hooks/useRecordings';

interface AuthContextType {
    user: User | null;
    session: Session | null;
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
    const [loading, setLoading] = useState(true);
    const claimMutation = useClaimRecordings();
    const hasClaimedRef = useRef(false);

    useEffect(() => {
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
    }, [claimMutation]);

    const signInWithGoogle = async () => {
        hasClaimedRef.current = false; // Reset on new sign in
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            console.error('Error signing in with Google:', error);
        }
    };

    const signOut = async () => {
        hasClaimedRef.current = false; // Reset on sign out
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
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
