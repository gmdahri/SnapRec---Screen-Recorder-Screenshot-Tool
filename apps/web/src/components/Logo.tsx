import React from 'react';
import { NavLink } from 'react-router-dom';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    /** When true (default), logo links to home. Set false for plain display. */
    clickable?: boolean;
}

const sizeClasses = {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-12',
};

const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
};

const LogoContent: React.FC<Pick<LogoProps, 'size' | 'showText'>> = ({
    size = 'md',
    showText = true,
}) => (
    <>
        <div className={`${sizeClasses[size]} flex items-center justify-center flex-shrink-0`}>
            <img src="/logo.png" alt="SnapRec Logo" className="w-full h-full object-contain" />
        </div>
        {showText && (
            <h1 className={`${textSizes[size]} font-bold tracking-tight text-slate-900 dark:text-white`}>SnapRec</h1>
        )}
    </>
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
