import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import UserMenu from './UserMenu';
import LoginModal from './LoginModal';

interface HeaderProps {
    title?: React.ReactNode;
    showBackButton?: boolean;
    actions?: React.ReactNode;
    center?: React.ReactNode;
    variant?: 'default' | 'transparent';
}

export const Header: React.FC<HeaderProps> = ({
    title,
    showBackButton = false,
    actions,
    center,
    variant = 'default',
}) => {
    const navigate = useNavigate();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const variantClasses = {
        default: 'bg-white dark:bg-[#1c142b] border-b border-[#ece7f4] dark:border-[#2d2245]',
        transparent: 'bg-transparent',
    };

    return (
        <>
            <header className={`h-16 px-6 flex items-center justify-between gap-4 shrink-0 transition-all ${variantClasses[variant]}`}>
                <div className="flex items-center gap-3 w-[350px] shrink-0 min-w-[300px]">
                    {showBackButton ? (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all text-slate-600 dark:text-slate-400"
                            title="Back to Dashboard"
                        >
                            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                        </button>
                    ) : (
                        <Logo size="md" />
                    )}
                    {title && (
                        <span className="text-sm font-semibold text-slate-500 w-full max-w-[400px] truncate"> {title}</span>
                    )}
                </div>

                <div className="flex-1 flex justify-center max-w-2xl px-4">
                    {center}
                </div>

                <div className="flex items-center gap-4 shrink-0 min-w-[200px] justify-end">
                    {actions}
                    <UserMenu onSignIn={() => setShowLoginModal(true)} />
                </div>
            </header>

            <LoginModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                actionDescription="access all features"
            />
        </>
    );
};

export default Header;
