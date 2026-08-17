import { useEffect, useState } from 'react';
import { CONSENT_EVENT, hasAdConsent } from '../lib/consent';

/** SEO W7 — the AdSense tag, gated.
 *
 * `index.html` used to carry `<script async src=...adsbygoogle.js>` in <head>,
 * so every marketing and blog page paid for third-party JS before the visitor
 * had answered the cookie banner. This mounts once at the app root and injects
 * the same script only after an explicit accept — which is both the CWV fix and
 * the consent-order fix.
 *
 * It is idempotent: GoogleAd injects the same URL when a placement mounts, and
 * the `script[src*="adsbygoogle"]` check means whoever gets there first wins. */
export function AdSenseLoader() {
    const [consented, setConsented] = useState(hasAdConsent);

    useEffect(() => {
        const onConsent = () => setConsented(hasAdConsent());
        window.addEventListener(CONSENT_EVENT, onConsent);
        return () => window.removeEventListener(CONSENT_EVENT, onConsent);
    }, []);

    useEffect(() => {
        if (!consented) return;

        const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
        if (!clientId) return;

        const isLocalhost = window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1';
        if (isLocalhost) return;

        if (document.querySelector('script[src*="adsbygoogle"]')) return;

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    }, [consented]);

    return null;
}

export default AdSenseLoader;
