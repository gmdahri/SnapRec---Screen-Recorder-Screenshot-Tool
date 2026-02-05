import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'size-6 border-2',
    md: 'size-10 border-3',
    lg: 'size-16 border-4',
};

export const Spinner: React.FC<SpinnerProps> = ({
    size = 'md',
    className = '',
}) => {
    return (
        <div
            className={`${sizeClasses[size]} border-primary/20 border-t-primary rounded-full animate-spin ${className}`}
        />
    );
};

export default Spinner;
