import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchWithAuth } from '../hooks/useRecordings';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();

    const hasRun = React.useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        // Handle the OAuth callback
        const handleCallback = async () => {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Auth callback error:', error);
                navigate('/login');
                return;
            }

            console.log('AuthCallback: Session data:', data);
            if (data.session) {
                try {
                    console.log('AuthCallback: Syncing user with backend REST endpoint...');
                    // This calls the backend to ensure the user exists in public.sr_users
                    // and triggers the welcome email if they are newly formed.
                    await fetchWithAuth('/users/sync', { method: 'POST' });
                    console.log('AuthCallback: User synced successfully');
                } catch (syncError) {
                    console.error('AuthCallback: Error syncing user:', syncError);
                }

                const returnPath = localStorage.getItem('auth_return_path');
                localStorage.removeItem('auth_return_path');
                console.log('AuthCallback: Redirecting to:', returnPath || '/dashboard');
                navigate(returnPath || '/dashboard', { replace: true });
            } else {
                navigate('/login', { replace: true });
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1c142b] via-[#2d2245] to-[#1c142b]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-white/60">Completing sign in...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
