import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo as Mark } from '@snaprec/design-system';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    /** When true (default), logo links to home. Set false for plain display. */
    clickable?: boolean;
}

const markSize = { sm: 16, md: 20, lg: 26 } as const;

export const Logo: React.FC<LogoProps> = ({
    size = 'md',
    showText = true,
    className = '',
    clickable = true,
}) => {
    const content = <Mark size={markSize[size]} withWordmark={showText} />;
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
