import React from 'react';
import { NavLink } from 'react-router-dom';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    /** When true (default), logo links to home. Set false for plain display. */
    clickable?: boolean;
}

/** Wordmark (purple mark + SnapRec) — single asset, no duplicate title text. */
const heightClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
};

const LogoContent: React.FC<Pick<LogoProps, 'size' | 'showText'>> = ({
    size = 'md',
    showText: _showText = true,
}) => (
    <img
        src="/logo.png"
        alt="SnapRec"
        className={`${heightClasses[size]} w-auto max-w-[min(100%,11rem)] object-contain object-left`}
        width={120}
        height={32}
    />
);

export const Logo: React.FC<LogoProps> = ({
    size = 'md',
    showText = true,
    className = '',
    clickable = true,
}) => {
    const content = <LogoContent size={size} showText={showText} />;
    const wrapperClass = `flex items-center gap-2 ${className}`;

    if (clickable) {
        return (
            <NavLink to="/" className={wrapperClass} aria-label="SnapRec home">
                {content}
            </NavLink>
        );
    }
    return <div className={wrapperClass}>{content}</div>;
};

export default Logo;
