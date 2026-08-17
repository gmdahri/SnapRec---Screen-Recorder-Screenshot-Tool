/** SEO W7 — one source of truth for the cookie banner's answer.
 *
 * The banner used to be the only reader and writer of this key, which meant
 * nothing else could react when someone accepted. AdSense now loads off the back
 * of it, so the write has to be observable: `setConsent` fires a window event
 * that AdSenseLoader and GoogleAd subscribe to. */

export const CONSENT_KEY = 'snaprec_cookie_consent';
export const CONSENT_EVENT = 'snaprec:consent';

export type ConsentValue = 'accepted' | 'declined' | null;

export function getConsent(): ConsentValue {
    try {
        const raw = localStorage.getItem(CONSENT_KEY);
        return raw === 'accepted' || raw === 'declined' ? raw : null;
    } catch {
        // Private mode / storage disabled. No stored answer means no consent.
        return null;
    }
}

export function setConsent(value: Exclude<ConsentValue, null>): void {
    try {
        localStorage.setItem(CONSENT_KEY, value);
    } catch {
        // Still notify listeners — the in-memory answer is valid for this session.
    }
    window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_EVENT, { detail: value }));
}

/** Ads and ad-adjacent analytics require an explicit yes, not merely "not no". */
export function hasAdConsent(): boolean {
    return getConsent() === 'accepted';
}
