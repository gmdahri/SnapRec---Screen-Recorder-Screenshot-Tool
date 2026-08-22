/** PostHog for the extension, over plain HTTP.
 *
 * WHY NOT posthog-js: the spec asked for posthog-js in the background script
 * with `persistence: 'localStorage'`. Neither is possible in Manifest V3. The
 * background script is a service worker — it has no `window`, no `document` and
 * no `localStorage`, and posthog-js is a DOM library that reaches for all three
 * at import time. Bundling it here would throw on the first line, and MV3 has no
 * build step in this project to bundle it with anyway.
 *
 * So this is a hand-rolled client against PostHog's documented capture endpoint,
 * POST https://us.i.posthog.com/i/v0/e. It covers what the extension actually
 * needs — a stable install id, an opt-out, and named events — in far less code
 * than the library, and it works inside a service worker.
 *
 * Identity and opt-out live in chrome.storage.local, which is the MV3 equivalent
 * of the requested localStorage persistence: it survives worker restarts and
 * browser restarts, which is the property that mattered.
 *
 * FIRE AND FORGET is the whole design. No caller awaits `track`. Every network
 * path ends in a swallowed rejection, so an offline user, a blocked domain, a
 * 500 from PostHog or a missing API key all behave identically: the recording
 * still happens and nothing surfaces to the user.
 *
 * Loaded via importScripts from background.js, after config.js — it reads
 * CONFIG.POSTHOG.
 */

const Analytics = (() => {
    const DISTINCT_ID_KEY = 'analyticsDistinctId';
    const OPT_OUT_KEY = 'analyticsOptOut';

    /** Resolved once per worker lifetime, then reused. */
    let distinctIdPromise = null;

    function settings() {
        const cfg = (typeof CONFIG !== 'undefined' && CONFIG.POSTHOG) || {};
        return {
            key: cfg.KEY || '',
            host: (cfg.HOST || 'https://us.i.posthog.com').replace(/\/+$/, ''),
        };
    }

    /** A random, non-identifying install id.
     *
     * Not a user id: it is generated locally, never derived from anything about
     * the machine or the person, and it is thrown away when the extension is
     * uninstalled or storage is cleared. It exists so "how many installs used
     * recording this week" is answerable at all. */
    async function distinctId() {
        if (!distinctIdPromise) {
            distinctIdPromise = (async () => {
                const stored = await chrome.storage.local.get(DISTINCT_ID_KEY);
                if (stored[DISTINCT_ID_KEY]) return stored[DISTINCT_ID_KEY];
                const id = crypto.randomUUID();
                await chrome.storage.local.set({ [DISTINCT_ID_KEY]: id });
                return id;
            })().catch(() => null);
        }
        return distinctIdPromise;
    }

    async function hasOptedOut() {
        try {
            const { [OPT_OUT_KEY]: optedOut } = await chrome.storage.local.get(OPT_OUT_KEY);
            return optedOut === true;
        } catch {
            // Storage unavailable: treat as opted out. Failing closed is the
            // right default for telemetry.
            return true;
        }
    }

    /** Stop sending events. Persists across restarts. */
    async function optOut() {
        try {
            await chrome.storage.local.set({ [OPT_OUT_KEY]: true });
        } catch { /* nothing to do */ }
    }

    /** Resume sending events. */
    async function optIn() {
        try {
            await chrome.storage.local.set({ [OPT_OUT_KEY]: false });
        } catch { /* nothing to do */ }
    }

    /** Properties attached to every event. Deliberately small and non-identifying. */
    function baseProperties() {
        let version = 'unknown';
        try {
            version = chrome.runtime.getManifest().version;
        } catch { /* not available in every context */ }
        return {
            extension_version: version,
            $lib: 'snaprec-extension',
            $lib_version: version,
        };
    }

    /** Send one event.
     *
     * Returns a promise so tests can await it, but NO production caller should:
     * awaiting puts PostHog's latency in front of the user's recording. The
     * promise always resolves — never rejects — so a forgotten await cannot
     * produce an unhandled rejection either.
     *
     * @returns {Promise<boolean>} true if the request was accepted.
     */
    async function track(event, properties = {}) {
        try {
            const { key, host } = settings();
            if (!key) return false;              // not configured — silently inert
            if (await hasOptedOut()) return false;

            const id = await distinctId();
            if (!id) return false;

            const response = await fetch(`${host}/i/v0/e`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: key,
                    event,
                    distinct_id: id,
                    properties: { ...baseProperties(), ...properties },
                    timestamp: new Date().toISOString(),
                }),
                // Telemetry must never hold a worker alive or retry into a
                // blocked network; one attempt, then forget.
                keepalive: true,
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    /** Only the host of a URL, never the path or query.
     *
     * A full tab URL is personal data — it can carry document names, ticket ids,
     * tokens in query strings. The host answers "what kind of site do people
     * record" without any of that. Returns null for chrome://, file:// and
     * anything unparseable. */
    function domainOf(url) {
        try {
            const { protocol, hostname } = new URL(url);
            if (protocol !== 'http:' && protocol !== 'https:') return null;
            return hostname || null;
        } catch {
            return null;
        }
    }

    return { track, optOut, optIn, hasOptedOut, distinctId, domainOf };
})();

// Classic script under importScripts — no module scope in a service worker.
if (typeof globalThis !== 'undefined') globalThis.Analytics = Analytics;
