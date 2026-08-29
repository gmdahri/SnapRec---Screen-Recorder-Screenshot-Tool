/** The web -> extension analytics handshake.
 *
 * PostHog identifies people by `distinct_id`. The web app's is posthog-js's
 * anonymous id; the extension mints its own UUID in the service worker, because
 * a Manifest V3 worker has no localStorage and no posthog-js to read it from.
 * Nothing ever connected the two, so the site's visitor and the install they
 * just performed were two unrelated people — and a funnel joins its steps on
 * the person. `pageview -> chrome_store_link_clicked -> extension_installed ->
 * recording_started` could therefore never get past step two, however many
 * install events the extension sent.
 *
 * This module hands the extension the visitor's distinct_id, which the
 * background client aliases onto its own. It also hands over where the visitor
 * came from, which is the one thing the install event wants and the extension
 * has no way of seeing.
 *
 * Only the anonymous analytics id crosses the boundary. Nothing is read back,
 * and manifest `externally_connectable` already limits who may call at all.
 */

const SOURCE_KEY = 'snaprec_install_source';

/* The handshake has to survive the gap between "page loaded" and "extension
 * exists". The install happens mid-session in another window, so the first
 * attempt almost always finds nothing there; the retries are what actually
 * land it, when the visitor returns to the tab. */
const RETRY_DELAYS_MS = [0, 2_000, 6_000, 15_000, 40_000];

type ExternalRuntime = {
    sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
};

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID as string | undefined;

/** Where this visitor came from, in one short string.
 *
 * First touch wins and is remembered: by the time the extension is installed
 * the campaign parameters are usually long gone from the URL, and a visitor who
 * arrived from an ad and installed three pages later still arrived from an ad.
 */
export function resolveInstallSource(
    location: { search: string; href: string },
    referrer: string,
    storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): string {
    const remembered = safely(() => storage?.getItem(SOURCE_KEY)) ?? null;
    if (remembered) return remembered;

    const source = deriveSource(location.search, referrer);
    safely(() => storage?.setItem(SOURCE_KEY, source));
    return source;
}

function deriveSource(search: string, referrer: string): string {
    const params = new URLSearchParams(search);
    const utmSource = params.get('utm_source');

    /* utm_source/utm_medium, because "google" alone cannot tell an ad from an
     * organic result — which is the entire question a paid campaign is asking. */
    if (utmSource) {
        const medium = params.get('utm_medium');
        return medium ? `${utmSource}/${medium}` : utmSource;
    }

    if (!referrer) return 'direct';

    try {
        const host = new URL(referrer).hostname.replace(/^www\./, '');
        // A referrer from our own site is not a source; the first touch that
        // brought them here already was.
        if (host.endsWith('snaprecorder.org')) return 'direct';
        return host;
    } catch {
        return 'direct';
    }
}

function safely<T>(fn: () => T): T | null {
    try {
        return fn();
    } catch {
        // Storage throws outright in some privacy modes.
        return null;
    }
}

/** Push the identity to the extension. Resolves true once it acknowledges. */
export function sendIdentity(
    distinctId: string,
    source: string,
    runtime: ExternalRuntime | undefined = (window as unknown as
        { chrome?: { runtime?: ExternalRuntime } }).chrome?.runtime,
): Promise<boolean> {
    if (!EXTENSION_ID || !runtime?.sendMessage || !distinctId) {
        return Promise.resolve(false);
    }

    return new Promise(resolve => {
        try {
            runtime.sendMessage!(
                EXTENSION_ID,
                { type: 'SNAPREC_ANALYTICS_IDENTITY', distinctId, source },
                (response: unknown) => {
                    // chrome.runtime.lastError is set when nothing is listening;
                    // reading nothing back is the "not installed" answer.
                    resolve(Boolean((response as { ok?: boolean } | undefined)?.ok));
                },
            );
        } catch {
            resolve(false);
        }
    });
}

/** Keep offering the identity until the extension takes it.
 *
 * Returns a teardown function. Stops as soon as the handshake succeeds — the
 * extension remembers the link, so there is nothing to repeat.
 */
export function startIdentityBridge(deps: {
    getDistinctId: () => string | null;
    getSource: () => string;
    send?: typeof sendIdentity;
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
    addVisibilityListener?: (fn: () => void) => () => void;
}): () => void {
    const send = deps.send ?? sendIdentity;
    const setTimer = deps.setTimeoutFn ?? setTimeout;
    const clearTimer = deps.clearTimeoutFn ?? clearTimeout;

    let done = false;
    let attempt = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryOnce = async () => {
        if (done) return;
        const id = deps.getDistinctId();
        if (!id) return;
        if (await send(id, deps.getSource())) done = true;
    };

    /* Chained rather than all queued up front: each attempt is scheduled only
     * once the previous one has answered. Queuing them together lets several
     * sends be in flight at the same time, so a success cannot stop the ones
     * already scheduled behind it. */
    const scheduleNext = () => {
        if (done || attempt >= RETRY_DELAYS_MS.length) return;
        const delay = RETRY_DELAYS_MS[attempt];
        attempt += 1;
        timers.push(setTimer(() => { void runAttempt(); }, delay));
    };

    const runAttempt = async () => {
        if (done) return;
        await tryOnce();
        scheduleNext();
    };

    scheduleNext();

    /* Returning to the tab is the strongest signal available that something
     * happened elsewhere — most often the install itself finishing in the Web
     * Store tab. Worth one more attempt even after the schedule is exhausted. */
    const removeVisibility = deps.addVisibilityListener?.(() => { void tryOnce(); })
        ?? attachVisibility(() => { void tryOnce(); });

    return () => {
        done = true;
        for (const t of timers) clearTimer(t);
        removeVisibility?.();
    };
}

function attachVisibility(fn: () => void): (() => void) | undefined {
    if (typeof document === 'undefined') return undefined;
    const handler = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
}
