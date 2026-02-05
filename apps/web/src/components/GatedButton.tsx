import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface GatedButtonProps {
    onClick: () => void;
    icon: string;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
    className?: string;
    disabled?: boolean;
    title?: string;
}

export const GatedButton: React.FC<GatedButtonProps> = ({
    onClick,
    icon,
    children,
    variant = 'secondary',
    className = '',
    disabled = false,
    title,
}) => {
    const { user } = useAuth();

    const baseClasses = 'flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90',
        secondary: 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span>{children}</span>
            {!user && (
                <span className="absolute -top-1 -right-1 size-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[10px]">lock</span>
                </span>
            )}
        </button>
    );
};

export default GatedButton;
