import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionDescription?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
    isOpen,
    onClose,
    actionDescription = 'continue',
}) => {
    const { signInWithGoogle, loading } = useAuth();

    const handleSignIn = async () => {
        await signInWithGoogle();
        onClose();
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
                        Sign in Required
                    </h3>
                    <p className="text-[var(--sr-text-faint-on-light)] text-sm">
                        Sign in with your Google account to {actionDescription}.
                    </p>
                </div>
                <div className="space-y-3">
                    <GoogleSignInButton
                        onClick={handleSignIn}
                        loading={loading}
                        fullWidth
                    />
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
