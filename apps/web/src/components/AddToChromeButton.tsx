import React from 'react';

interface AddToChromeButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'white';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const EXTENSION_URL = "https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg?authuser=0&hl=en";

export const AddToChromeButton: React.FC<AddToChromeButtonProps> = ({
    variant = 'primary',
    size = 'md',
    className = '',
}) => {
    const baseStyles = "flex items-center justify-center gap-3 font-bold transition-all rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md group";

    const variants = {
        primary: "bg-primary hover:bg-primary/90 text-white shadow-primary/30",
        secondary: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30",
        outline: "bg-transparent border-2 border-primary text-primary hover:bg-primary/5 shadow-none",
        white: "bg-white text-slate-900 hover:bg-slate-50 shadow-slate-200/50",
    };

    const sizes = {
        sm: "px-4 py-2 text-sm rounded-xl gap-2",
        md: "px-6 py-3 text-base rounded-xl gap-2.5",
        lg: "px-8 py-4 text-lg rounded-2xl gap-3",
        xl: "px-10 py-5 text-xl rounded-2xl gap-4",
    };

    return (
        <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        >
            <img
                src="https://www.google.com/chrome/static/images/chrome-logo.svg"
                alt="Chrome"
                className={`${size === 'sm' ? 'size-4' : size === 'md' ? 'size-5' : 'size-6'} group-hover:rotate-12 transition-transform`}
            />
            <span>Add to Chrome (Free)</span>
        </a>
    );
};
