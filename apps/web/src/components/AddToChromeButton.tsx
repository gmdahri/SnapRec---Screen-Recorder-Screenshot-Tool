import React from 'react';
// Analytics: this button is the site's primary conversion, so it reports both
// the generic CTA event and the store-specific one.
import { capture } from '../lib/analytics';

interface AddToChromeButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'white';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    /** Where this instance sits, e.g. 'landing_hero'. Reported as the CTA
     * `location` so the same button can be compared across placements. */
    location?: string;
}

const EXTENSION_URL = "https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg?authuser=0&hl=en";

export const AddToChromeButton: React.FC<AddToChromeButtonProps> = ({
    variant = 'primary',
    size = 'md',
    className = '',
    location = 'unspecified',
}) => {
    // Fire-and-forget: capture never throws and never blocks navigation, so the
    // link behaves identically whether or not PostHog is configured or online.
    const onClick = () => {
        capture('cta_clicked', { location });
        capture('chrome_store_link_clicked', { location });
    };

    const baseStyles = "flex items-center justify-center gap-3 font-bold transition-all rounded-[2px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md group";

    const variants = {
        primary: "bg-[var(--sr-cyan)] hover:bg-[var(--sr-cyan)]/90 text-white shadow-primary/30",
        secondary: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30",
        outline: "bg-transparent border-2 border-primary text-[var(--sr-cyan-on-light)] hover:bg-[var(--sr-cyan)]/5 shadow-none",
        white: "bg-[var(--sr-surface-paper)] text-[var(--sr-text-primary-on-light)] hover:bg-[var(--sr-surface-panel-light)] shadow-slate-200/50",
    };

    const sizes = {
        sm: "px-4 py-2 text-sm rounded-[2px] gap-2",
        md: "px-6 py-3 text-base rounded-[2px] gap-2.5",
        lg: "px-8 py-4 text-lg rounded-[2px] gap-3",
        xl: "px-10 py-5 text-xl rounded-[2px] gap-4",
    };

    return (
        <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClick}
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
