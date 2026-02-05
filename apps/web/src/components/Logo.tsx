import React from 'react';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-12',
};

const iconSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
};

const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
};

export const Logo: React.FC<LogoProps> = ({
    size = 'md',
    showText = true,
    className = '',
}) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className={`${sizeClasses[size]} bg-primary rounded-lg flex items-center justify-center text-white`}>
                <span className={`material-symbols-outlined ${iconSizes[size]}`}>crop_free</span>
            </div>
            {showText && (
                <h1 className={`${textSizes[size]} font-bold tracking-tight`}>SnapRec</h1>
            )}
        </div>
    );
};

export default Logo;
