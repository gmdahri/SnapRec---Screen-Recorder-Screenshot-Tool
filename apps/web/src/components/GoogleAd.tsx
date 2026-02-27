import React, { useEffect, useRef, useCallback } from 'react';

interface GoogleAdProps {
    className?: string;
    style?: React.CSSProperties;
    /** Required: the ad slot ID for this specific placement from your AdSense dashboard. */
    slotId: string;
    /** Optional: suggest an ad format ('auto', 'horizontal', 'vertical', 'rectangle'). Defaults to 'auto'. */
    format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
}

/**
 * GoogleAd Component
 * 
 * Renders a Google AdSense display ad unit.
 * Each placement must provide its own slotId from the AdSense dashboard.
 */
const GoogleAd: React.FC<GoogleAdProps> = ({ className = "", style = {}, slotId, format = "auto" }) => {
    const CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    const SLOT_ID = slotId;
    const adRef = useRef<HTMLElement | null>(null);
    const pushAttempted = useRef(false);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const pushAd = useCallback(() => {
        try {
            const ins = adRef.current;
            if (!ins) return;
            // Prevent double-push for this specific ad unit
            if (pushAttempted.current) return;
            if (ins.getAttribute('data-adsbygoogle-status')) return;

            pushAttempted.current = true;
            (window as any).adsbygoogle = (window as any).adsbygoogle || [];
            (window as any).adsbygoogle.push({});
        } catch (e) {
            // Suppress "already have ads" errors which are common in dev/hot-reload
            if (e instanceof Error && !e.message.includes('already have ads')) {
                console.error("AdSense error:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (!CLIENT_ID || !SLOT_ID || isLocalhost) return;

        const existingScript = document.querySelector('script[src*="adsbygoogle"]') as HTMLScriptElement | null;

        if (existingScript) {
            // Script tag already exists — check if it's loaded
            if ((window as any).adsbygoogle) {
                // Script is already loaded and ready
                requestAnimationFrame(() => pushAd());
            } else {
                // Script tag exists but hasn't loaded yet — listen for load
                const onLoad = () => requestAnimationFrame(() => pushAd());
                existingScript.addEventListener('load', onLoad);
                return () => existingScript.removeEventListener('load', onLoad);
            }
        } else {
            // First mount — inject the script and wait for onload
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
            script.crossOrigin = 'anonymous';
            script.onload = () => requestAnimationFrame(() => pushAd());
            script.onerror = () => console.error('AdSense script failed to load');
            document.head.appendChild(script);
        }

        return () => {
            pushAttempted.current = false;
        };
    }, [CLIENT_ID, SLOT_ID, isLocalhost, pushAd]);

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
        <div className={`google-ad-container overflow-hidden rounded-xl ${className}`} style={{ minHeight: '90px', ...style }}>
            <ins
                ref={adRef as any}
                className="adsbygoogle"
                style={{ display: 'block', minHeight: '90px', ...style }}
                data-ad-client={CLIENT_ID}
                data-ad-slot={SLOT_ID}
                data-ad-format={format}
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};

export default GoogleAd;
