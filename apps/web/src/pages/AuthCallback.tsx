import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Handle the OAuth callback
        const handleCallback = async () => {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Auth callback error:', error);
                navigate('/login');
                return;
            }

            if (data.session) {
                // Successfully authenticated, redirect to dashboard
                navigate('/dashboard');
            } else {
                // No session, redirect to login
                navigate('/login');
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
