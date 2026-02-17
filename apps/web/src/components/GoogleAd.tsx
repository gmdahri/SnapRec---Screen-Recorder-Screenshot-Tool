import React, { useEffect } from 'react';

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

    useEffect(() => {
        if (!CLIENT_ID || !SLOT_ID) return;

        try {
            // Push to Adsense queue
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense error:", e);
        }
    }, [CLIENT_ID, SLOT_ID]);

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

    return (
        <div className={`google-ad-container overflow-hidden rounded-xl ${className}`} style={style}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block', ...style }}
                data-ad-client={CLIENT_ID}
                data-ad-slot={SLOT_ID}
                data-ad-format="auto"
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};

export default GoogleAd;
