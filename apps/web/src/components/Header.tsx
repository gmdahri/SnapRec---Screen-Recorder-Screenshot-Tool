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
            <header className={`h-16 px-6 flex items-center justify-between ${variantClasses[variant]}`}>
                <div className="flex items-center gap-3">
                    <Logo size="md" />
                    {title && (
                        <>
                            <span className="text-sm text-slate-500">/</span>
                            <div className="text-sm font-medium">{title}</div>
                        </>
                    )}
                </div>

                <div className="flex-1 flex justify-center px-4">
                    {center}
                </div>
                <div className="flex items-center gap-4">
                    {showBackButton && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] rounded-xl transition-all font-medium text-sm cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            <span>Dashboard</span>
                        </button>
                    )}
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
