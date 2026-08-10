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

/** A header action that signs-in first when there is no session.
 *
 * Only the image editor uses this, and its header is a dark Technical surface,
 * so the tokens here are the on-dark set. The amber lock bubble that used to
 * float off the corner is now an inline glyph: "sign in first" is a gate, not
 * an alarm, and amber was outside the palette entirely. */
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

    const base =
        'inline-flex items-center gap-2 h-[34px] px-3.5 rounded-[2px] font-medium text-[13px] ' +
        'transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

    const variants = {
        primary:
            'bg-[var(--sr-cyan)] text-[var(--sr-cyan-fg)] hover:bg-[var(--sr-cyan-hover)]',
        secondary:
            'border border-[var(--sr-border-dark)] text-[var(--sr-text-secondary-on-dark)] ' +
            'hover:text-[var(--sr-text-primary-on-dark)] hover:border-[var(--sr-border-dark-strong)]',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={!user ? `${title ?? ''} — sign in first`.trim() : title}
            className={`${base} ${variants[variant]} ${className}`}
        >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            <span>{children}</span>
            {!user && (
                <span
                    aria-label="Sign in required"
                    className="material-symbols-outlined text-[14px] opacity-60"
                >lock</span>
            )}
        </button>
    );
};

export default GatedButton;
