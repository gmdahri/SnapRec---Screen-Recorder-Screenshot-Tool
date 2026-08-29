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

    /* ── The install event ────────────────────────────────────────────────────
     *
     * Every other event can be missed without consequence — there will be
     * another recording. `chrome.runtime.onInstalled` fires once, ever, in a
     * service worker Chrome is free to terminate as soon as the listener
     * returns. So the install is written to storage synchronously and sent
     * afterwards: a worker death, an offline laptop or a blocked domain costs a
     * retry rather than the datapoint.
     *
     * It is also the only event that wants a property the extension cannot see.
     * `install_source` lives in the tab that installed it, so the send waits a
     * few minutes for the web app's handshake (linkWebIdentity) and then gives
     * up and sends anyway — an install counted as 'unknown' beats one that is
     * never counted. */
    const PENDING_INSTALL_KEY = 'analyticsPendingInstall';
    const WEB_IDENTITY_KEY = 'analyticsWebDistinctId';
    const INSTALL_SOURCE_KEY = 'analyticsInstallSource';

    /** How long to hold the install event open for the web handshake. */
    const INSTALL_GRACE_MS = 5 * 60 * 1000;

    /** Record that this profile installed the extension.
     *
     * Called from the onInstalled listener under `reason === 'install'` only —
     * 'update' and 'chrome_update' fire there too and are not installs. Writes
     * one record; sends nothing. */
    async function queueInstall() {
        try {
            const existing = await chrome.storage.local.get(PENDING_INSTALL_KEY);
            if (existing[PENDING_INSTALL_KEY]) return;   // already queued

            let version = 'unknown';
            try { version = chrome.runtime.getManifest().version; } catch { /* no manifest */ }

            await chrome.storage.local.set({
                [PENDING_INSTALL_KEY]: {
                    version,
                    timestamp: Date.now(),
                    queuedAt: Date.now(),
                    /* PostHog deduplicates on $insert_id, so a retry after a
                     * response we never saw cannot count the install twice. */
                    insertId: crypto.randomUUID(),
                },
            });
        } catch { /* storage gone; nothing left to try */ }
    }

    /** Send the queued install event, if it is ready to go.
     *
     * Safe to call as often as anything likes: it is a no-op with nothing
     * queued, holds off while the handshake still has time to arrive, and only
     * clears the record once PostHog has accepted it.
     *
     * @returns {Promise<boolean>} true if the event was accepted and cleared.
     */
    async function flushPendingInstall() {
        try {
            const stored = await chrome.storage.local.get([
                PENDING_INSTALL_KEY, INSTALL_SOURCE_KEY,
            ]);
            const pending = stored[PENDING_INSTALL_KEY];
            if (!pending) return false;

            /* Opting out drops the record rather than holding it. Keeping a
             * queued event for someone who has said no would mean it fired the
             * day they changed their mind, and it would leave the retry alarm
             * running forever with nothing it is allowed to send. */
            if (await hasOptedOut()) {
                await chrome.storage.local.remove(PENDING_INSTALL_KEY);
                return false;
            }

            const source = stored[INSTALL_SOURCE_KEY];
            const expired = Date.now() - (pending.queuedAt ?? 0) >= INSTALL_GRACE_MS;
            if (!source && !expired) return false;   // the handshake still has time

            const sent = await track('extension_installed', {
                install_source: source || 'unknown',
                version: pending.version,
                timestamp: pending.timestamp,
                $insert_id: pending.insertId,
                $set: { installed_version: pending.version },
            });

            // Left in place on failure — the next worker wake-up retries it.
            if (sent) await chrome.storage.local.remove(PENDING_INSTALL_KEY);
            return sent;
        } catch {
            return false;
        }
    }

    /** Whether an install event is still waiting to be delivered.
     *
     * Lets the retry alarm stop itself: "nothing pending" covers both a
     * delivered event and one dropped because the user opted out. */
    async function hasPendingInstall() {
        try {
            const stored = await chrome.storage.local.get(PENDING_INSTALL_KEY);
            return Boolean(stored[PENDING_INSTALL_KEY]);
        } catch {
            return false;
        }
    }

    /** Adopt the web app's PostHog identity.
     *
     * The extension mints its own distinct_id, so without this the website's
     * visitor and the extension's install are two unrelated people in PostHog
     * and no funnel can span them — which is exactly why the activation funnel
     * read zero at the install step no matter how many events arrived.
     *
     * `$create_alias` merges the two, and PostHog applies the merge to events
     * already ingested, so this repairs the funnel retroactively rather than
     * only from here on. The extension's own id stays the primary one; nothing
     * about the person is read back out of the web app.
     */
    async function linkWebIdentity(payload) {
        try {
            const webId = payload?.distinctId;
            if (typeof webId !== 'string' || !webId) return false;

            const source = payload?.source;
            const stored = await chrome.storage.local.get(WEB_IDENTITY_KEY);

            if (source) await chrome.storage.local.set({ [INSTALL_SOURCE_KEY]: source });

            // Already merged with this visitor — aliasing again would be noise.
            if (stored[WEB_IDENTITY_KEY] === webId) return false;

            const id = await distinctId();
            if (!id || id === webId) return false;

            const aliased = await track('$create_alias', { alias: webId, distinct_id: id });
            if (aliased) await chrome.storage.local.set({ [WEB_IDENTITY_KEY]: webId });
            return aliased;
        } catch {
            return false;
        }
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

    return {
        track, optOut, optIn, hasOptedOut, distinctId, domainOf,
        queueInstall, flushPendingInstall, hasPendingInstall, linkWebIdentity,
    };
})();

// Classic script under importScripts — no module scope in a service worker.
if (typeof globalThis !== 'undefined') globalThis.Analytics = Analytics;
