import React, { useEffect, useRef } from 'react';

interface GoogleAdProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * GoogleAd Component
 * 
 * Renders a Google AdSense display ad unit.
 * Uses environment variables for Client ID and Slot ID.
 */
const GoogleAd: React.FC<GoogleAdProps> = ({ className = "", style = {} }) => {
    const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    const SLOT_ID = import.meta.env.VITE_ADSENSE_SLOT_ID;
    const adRef = useRef<HTMLElement | null>(null);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    useEffect(() => {
        if (!CLIENT_ID || !SLOT_ID || isLocalhost) return;

        // Dynamically inject the AdSense script with the real client ID
        if (!document.querySelector('script[src*="adsbygoogle"]')) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        const pushAd = () => {
            try {
                const ins = adRef.current;
                // Check if this specific unit is already initialized using the AdSense status attribute
                if (ins && (ins as any).getAttribute('data-adsbygoogle-status')) return;

                (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                (window as any).adsbygoogle.push({});
            } catch (e) {
                // Suppress "already have ads" errors which are common in dev/hot-reload
                if (e instanceof Error && !e.message.includes('already have ads')) {
                    console.error("AdSense error:", e);
                }
            }
        };

        // Delay to ensure the script is loaded and DOM is stable
        const timer = setTimeout(pushAd, 300);
        return () => clearTimeout(timer);
    }, [CLIENT_ID, SLOT_ID, isLocalhost]);

    if (!CLIENT_ID || !SLOT_ID) {
        return (
            <div className={`bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-center group transition-all hover:border-primary/50 ${className}`} style={{ minHeight: '250px', ...style }}>
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">ads_click</span>
                </div>
                <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Ad Placement</h5>
                <p className="text-xs text-slate-500 max-w-[180px]">Configure VITE_ADSENSE_CLIENT_ID and VITE_ADSENSE_SLOT_ID in .env</p>
            </div>
        );
    }

    // On localhost, we suppress real ads to avoid 400 errors and noise in the console.
    // AdSense often rejects localhost even with adtest=on if the domain is not verified.
    if (isLocalhost) {
        return (
            <div className={`bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center ${className}`} style={{ minHeight: '250px', ...style }}>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Advertisement</p>
                <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                    <span className="material-symbols-outlined text-sm">info</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Ads suppressed on localhost</p>
            </div>
        );
    }

    return (
        <div className={`google-ad-container overflow-hidden rounded-xl ${className}`} style={style}>
            <ins
                ref={adRef as any}
                className="adsbygoogle"
                style={{ display: 'block', ...style }}
                data-ad-client={CLIENT_ID}
                data-ad-slot={SLOT_ID}
                data-ad-format="auto"
                data-full-width-responsive="true"
                data-adtest="off"
            ></ins>
        </div>
    );
};

export default GoogleAd;
