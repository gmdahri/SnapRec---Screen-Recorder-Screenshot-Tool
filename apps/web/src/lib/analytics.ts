/** PostHog, wrapped.
 *
 * Every event name and property shape in the web app lives in EVENTS below, so
 * a typo is a type error rather than a silently-orphaned event in the PostHog
 * UI. Nothing else in the app imports `posthog-js` directly.
 *
 * Three rules this module enforces so analytics can never break the product:
 *
 *   1. No key, no PostHog. `init` is skipped entirely when the env var is
 *      unset, and every call below becomes a no-op. Local dev and any build
 *      without the key behave exactly as they did before analytics existed.
 *   2. Every call is wrapped. posthog-js is resilient, but a capture must never
 *      be able to throw into a click handler or a render.
 *   3. Capture is fire-and-forget. Nothing awaits the network; PostHog queues
 *      and retries internally, and an offline visitor sees no difference.
 */

import type { PostHog } from 'posthog-js';
import { CONSENT_EVENT, getConsent } from './consent';

/** The whole analytics surface. Adding an event means adding it here first. */
export interface AnalyticsEvents {
    /** Any primary call-to-action. `location` is where on the site it sits. */
    cta_clicked: { location: string };
    /** A click through to the Chrome Web Store listing. */
    chrome_store_link_clicked: { location: string };
    /** A click through to Patreon.
     *
     * `tier` is optional because the app has no tier concept — there is one
     * static Patreon URL (lib/patreon.ts) and no tier selection anywhere. The
     * property is declared so it can be populated the day tiers exist, rather
     * than shipping an invented value now. */
    patreon_link_clicked: { location: string; tier?: string };
    /** A marketing section scrolled into view. Fired once per page view. */
    page_section_viewed: { section_name: string };

    /* The next two are named as extension events in the tracking plan, but the
     * actions themselves live in the web app: the share page owns both the
     * download button and the copy-link control. The extension's only
     * chrome.downloads call is an error fallback, so instrumenting it there
     * would have recorded almost nothing. Same PostHog project either way. */

    /** A recording or screenshot downloaded from the share page. */
    recording_downloaded: { capture_type: string; surface: string };
    /** A share link copied. */
    recording_shared: { method: string; surface: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/* Vite only exposes env vars prefixed VITE_, and inlines them at build time —
 * so this must be set in the Cloudflare Pages build environment, not just in a
 * local .env. A PostHog project API key is a publishable client credential
 * (it ships in the bundle by design and can only write events), not a secret. */
const API_KEY = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined;
const API_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined)
    ?? 'https://us.i.posthog.com';

/* posthog-js is ~250 KB raw / ~84 KB gzipped. Statically imported it lands in
 * the main chunk and is parsed before first paint, which is a real LCP cost for
 * a script that is not part of the product. So it is imported dynamically, after
 * the page is interactive, and calls made before it arrives are queued.
 *
 * The queue is bounded: if PostHog never loads (blocked, offline, no key) the
 * events are simply dropped rather than growing without limit. */
let ph: PostHog | null = null;
let loading = false;
let optedOutBeforeLoad = false;

const MAX_QUEUED = 50;
const queue: Array<(client: PostHog) => void> = [];

function enqueue(fn: (client: PostHog) => void): void {
    if (ph) {
        safely(() => fn(ph as PostHog));
        return;
    }
    if (queue.length < MAX_QUEUED) queue.push(fn);
}

/** True once PostHog is loaded and the visitor has not opted out. */
function active(): boolean {
    return ph !== null && !hasOptedOut();
}

/** Swallow anything analytics throws. A broken metric is not a broken product. */
function safely(fn: () => void): void {
    try {
        fn();
    } catch (err) {
        if (import.meta.env.DEV) console.warn('[analytics]', err);
    }
}

/** Start PostHog. Call once, from the app entry point.
 *
 * Returns immediately — the library is fetched in the background. */
export function initAnalytics(): void {
    if (loading || ph || !API_KEY) return;
    loading = true;

    /* requestIdleCallback keeps the fetch behind anything the user can see.
     * setTimeout is the Safari fallback. */
    const start = () => { void loadAndInit(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 3000 });
    else setTimeout(start, 1200);

    /* The cookie banner is the opt-out control. lib/consent.ts broadcasts on
     * answer, so declining stops capture immediately rather than at next load. */
    window.addEventListener(CONSENT_EVENT, () => {
        if (getConsent() === 'declined') optOut();
        else optIn();
    });
}

async function loadAndInit(): Promise<void> {
    if (!API_KEY) return;

    let client: PostHog;
    try {
        client = (await import('posthog-js')).default;
    } catch {
        // Blocked by an extension, offline, or the chunk 404s after a deploy.
        // Analytics simply never starts; the app is unaffected.
        queue.length = 0;
        return;
    }

    safely(() => {
        client.init(API_KEY, {
            api_host: API_HOST,

            // Autocapture gives clicks, inputs and form submits without
            // instrumenting each one. The named events above are the ones worth
            // reasoning about in a funnel; autocapture is the safety net for
            // everything nobody thought to instrument.
            autocapture: true,

            /* Pageviews are sent by trackPageview() on route change instead of
             * automatically. This is a React Router SPA: the automatic pageview
             * fires once on load, so every subsequent navigation would be
             * invisible and every session would look like a one-page bounce. */
            capture_pageview: false,
            capture_pageleave: true,

            // Off by default. Both are opt-in decisions with privacy and cost
            // implications that nobody has made yet.
            disable_session_recording: true,

            persistence: 'localStorage+cookie',

            loaded: (loaded) => {
                // Consent may already have been declined in a previous session,
                // or while the library was still downloading.
                if (getConsent() === 'declined' || optedOutBeforeLoad) loaded.opt_out_capturing();
            },
        });

        ph = client;
    });

    // Drain anything captured while the library was in flight.
    const pending = queue.splice(0, queue.length);
    if (ph) for (const fn of pending) safely(() => fn(ph as PostHog));
}

/** Record an event. Typed against AnalyticsEvents, and never throws. */
export function capture<E extends AnalyticsEventName>(
    event: E,
    properties: AnalyticsEvents[E],
): void {
    if (optedOutBeforeLoad) return;
    enqueue((client) => {
        if (client.has_opted_out_capturing()) return;
        client.capture(event, properties);
    });
}

/** A single SPA navigation. Called by usePageviews on every route change. */
export function trackPageview(path: string): void {
    if (optedOutBeforeLoad) return;
    const url = window.location.origin + path;
    enqueue((client) => {
        if (client.has_opted_out_capturing()) return;
        client.capture('$pageview', { $current_url: url });
    });
}

/** Stop capturing and remember that across sessions. */
export function optOut(): void {
    // Remembered even if the library has not loaded, so a decline during the
    // download window is still honoured.
    optedOutBeforeLoad = true;
    queue.length = 0;
    if (ph) safely(() => (ph as PostHog).opt_out_capturing());
}

/** Resume capturing. */
export function optIn(): void {
    optedOutBeforeLoad = false;
    if (ph) safely(() => {
        const client = ph as PostHog;
        if (client.has_opted_out_capturing()) client.opt_in_capturing();
    });
}

/** Whether this visitor has opted out. Safe to call before init. */
export function hasOptedOut(): boolean {
    if (optedOutBeforeLoad) return true;
    if (!ph) return false;
    try {
        return ph.has_opted_out_capturing();
    } catch {
        return false;
    }
}

/** Escape hatch for anything this wrapper does not cover. Prefer `capture`. */
export function posthogClient(): PostHog | null {
    return active() ? ph : null;
}
