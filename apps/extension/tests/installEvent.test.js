import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/** The install event is the one event that cannot be re-derived.
 *
 * `chrome.runtime.onInstalled` fires exactly once in the lifetime of an
 * install, in a service worker that Chrome may terminate a moment later. A
 * fire-and-forget fetch is fine for `recording_started` — there will be another
 * one — but if the install POST is in flight when the worker dies, that install
 * is uncountable forever. So the fact of the install is written to
 * chrome.storage.local first and sent afterwards, and these tests pin that
 * ordering down.
 */
function load({ key = 'phc_test', optedOut = false, store = {}, fetchImpl, now = 1_000_000 } = {}) {
    const state = { analyticsOptOut: optedOut, ...store };
    const calls = [];

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        URL,
        JSON,
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [now])); }
            static now() { return now; }
        },
        CONFIG: { POSTHOG: { KEY: key, HOST: 'https://us.i.posthog.com' } },
        crypto: { randomUUID: () => 'uuid-fixed' },
        chrome: {
            runtime: { getManifest: () => ({ version: '9.9.9' }) },
            storage: {
                local: {
                    get: async (k) => {
                        const keys = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
                        const out = {};
                        for (const key of keys) if (key in state) out[key] = state[key];
                        return out;
                    },
                    set: async (obj) => { Object.assign(state, obj); },
                    remove: async (k) => {
                        for (const key of (Array.isArray(k) ? k : [k])) delete state[key];
                    },
                },
            },
        },
        fetch: fetchImpl ?? vi.fn(async (url, init) => {
            calls.push({ url, body: JSON.parse(init.body) });
            return { ok: true };
        }),
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../background/analytics.js'), 'utf8'), sandbox);
    return { api: sandbox.Analytics, calls, state };
}

const eventsOf = (calls) => calls.map(c => c.body.event);

describe('install event durability', () => {
    it('records the install in storage without waiting on the network', async () => {
        // No fetch at all: the worker could die here and the install must survive.
        const { api, state, calls } = load({ fetchImpl: async () => { throw new Error('offline'); } });

        await api.queueInstall();

        expect(state.analyticsPendingInstall).toMatchObject({ version: '9.9.9' });
        expect(calls).toHaveLength(0);
    });

    it('sends extension_installed with the required properties once flushed', async () => {
        const { api, calls } = load();

        await api.queueInstall();
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'google/cpc' });
        await api.flushPendingInstall();

        const install = calls.find(c => c.body.event === 'extension_installed');
        expect(install).toBeDefined();
        expect(install.body.properties).toMatchObject({
            version: '9.9.9',
            install_source: 'google/cpc',
        });
        expect(typeof install.body.properties.timestamp).toBe('number');
    });

    it('fires exactly once — a second flush sends nothing', async () => {
        const { api, calls } = load();

        await api.queueInstall();
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.flushPendingInstall();
        await api.flushPendingInstall();

        expect(eventsOf(calls).filter(e => e === 'extension_installed')).toHaveLength(1);
    });

    it('keeps the record for a retry when the send fails', async () => {
        let online = false;
        const calls = [];
        const { api, state } = load({
            fetchImpl: async (url, init) => {
                if (!online) throw new Error('offline');
                calls.push({ url, body: JSON.parse(init.body) });
                return { ok: true };
            },
        });

        await api.queueInstall();
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.flushPendingInstall();
        expect(state.analyticsPendingInstall).toBeDefined();   // not lost

        online = true;
        await api.flushPendingInstall();
        expect(eventsOf(calls)).toContain('extension_installed');
        expect(state.analyticsPendingInstall).toBeUndefined(); // now cleared
    });

    it('carries a stable $insert_id so a retried send cannot double count', async () => {
        let attempt = 0;
        const bodies = [];
        const { api } = load({
            fetchImpl: async (url, init) => {
                const body = JSON.parse(init.body);
                bodies.push(body);
                if (body.event !== 'extension_installed') return { ok: true };
                attempt += 1;
                return { ok: attempt > 1 };   // first install attempt rejected
            },
        });

        await api.queueInstall();
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.flushPendingInstall();
        await api.flushPendingInstall();

        const installs = bodies.filter(b => b.event === 'extension_installed');
        expect(installs).toHaveLength(2);
        expect(installs[0].properties.$insert_id).toBe(installs[1].properties.$insert_id);
    });

    /* The web app is the only place the acquisition source is known. The
     * extension gets at most a few seconds of overlap with the tab that
     * installed it, so the send waits briefly — but never forever. */
    it('waits for the web handshake before sending, within the grace window', async () => {
        const { api, calls } = load();

        await api.queueInstall();
        await api.flushPendingInstall();

        expect(eventsOf(calls)).not.toContain('extension_installed');
    });

    it('gives up waiting and sends once the grace window has passed', async () => {
        const queuedAt = 1_000_000;
        const { api, calls } = load({
            now: queuedAt + 10 * 60 * 1000,
            store: {
                analyticsPendingInstall: {
                    version: '9.9.9', timestamp: queuedAt, queuedAt, insertId: 'ins-1',
                },
            },
        });

        await api.flushPendingInstall();

        const install = calls.find(c => c.body.event === 'extension_installed');
        expect(install).toBeDefined();
        expect(install.body.properties.install_source).toBe('unknown');
    });
});

/* The listener itself, read as source. onInstalled cannot be driven from a VM,
 * but the gate in front of it is the whole difference between an install count
 * and a release-day spike, so it is worth pinning. */
describe('the onInstalled gate', () => {
    const background = readFileSync(resolve(__dirname, '../background/background.js'), 'utf8');
    const listener = background.slice(
        background.indexOf('chrome.runtime.onInstalled.addListener'),
        background.indexOf('chrome.contextMenus.onClicked'),
    );

    /* 'update' fires on every release and 'chrome_update' on every browser
     * update — counting either would put a spike in the install number for all
     * existing users each time we ship. */
    it('queues only on a first install', () => {
        expect(listener).toContain("reason === 'install'");

        const gate = listener.indexOf("reason === 'install'");
        // The call expression, not the bare word: the comment above the gate
        // names queueInstall too, and matched first.
        const call = listener.indexOf('Analytics.queueInstall(');
        expect(call, 'queueInstall must sit inside the install gate').toBeGreaterThan(gate);
        expect(listener.slice(gate, call)).not.toContain('}');
    });

    it('persists the install before trying to send it', () => {
        expect(listener.indexOf('Analytics.queueInstall('))
            .toBeLessThan(listener.indexOf('Analytics.flushPendingInstall('));
    });

    /* The old code called track() straight from the listener. The listener
     * returns immediately and Chrome may stop the worker, so an in-flight POST
     * took the only install event this profile would ever produce with it. */
    it('does not send the install straight from the listener', () => {
        expect(listener).not.toContain("track('extension_installed'");
    });
});

describe('web -> extension identity bridge', () => {
    /* Without this the activation funnel cannot exist. The web app's person is
     * posthog-js's anonymous id; the extension's is a locally minted UUID. A
     * funnel joins its steps on the person, so pageview -> store click ->
     * installed -> recording can never complete while the two are strangers. */
    it('aliases the extension install id to the web visitor', async () => {
        const { api, calls } = load();

        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });

        const alias = calls.find(c => c.body.event === '$create_alias');
        expect(alias).toBeDefined();
        expect(alias.body.distinct_id).toBe('uuid-fixed');
        expect(alias.body.properties.alias).toBe('web-abc');
    });

    it('remembers the link so a later worker does not re-alias', async () => {
        const { api, calls, state } = load();

        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });

        expect(eventsOf(calls).filter(e => e === '$create_alias')).toHaveLength(1);
        expect(state.analyticsWebDistinctId).toBe('web-abc');
    });

    it('ignores a junk handshake rather than aliasing to nothing', async () => {
        const { api, calls, state } = load();

        await api.linkWebIdentity({ distinctId: '', source: 'direct' });
        await api.linkWebIdentity(null);

        expect(eventsOf(calls)).not.toContain('$create_alias');
        expect(state.analyticsWebDistinctId).toBeUndefined();
    });

    it('stays silent when the user has opted out', async () => {
        const { api, calls } = load({ optedOut: true });

        await api.queueInstall();
        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.flushPendingInstall();

        expect(calls).toHaveLength(0);
    });

    /* Holding the record would mean the event fired on the day they changed
     * their mind, and would leave the retry alarm running forever. */
    it('drops a queued install when the user has opted out', async () => {
        const { api, state } = load({ optedOut: true });

        await api.queueInstall();
        expect(state.analyticsPendingInstall).toBeDefined();

        await api.flushPendingInstall();

        expect(state.analyticsPendingInstall).toBeUndefined();
        await expect(api.hasPendingInstall()).resolves.toBe(false);
    });

    /* The retry alarm stops itself on this, so it has to be true only while
     * something is genuinely still owed. */
    it('reports whether delivery is still owed', async () => {
        const { api } = load();

        await expect(api.hasPendingInstall()).resolves.toBe(false);
        await api.queueInstall();
        await expect(api.hasPendingInstall()).resolves.toBe(true);

        await api.linkWebIdentity({ distinctId: 'web-abc', source: 'direct' });
        await api.flushPendingInstall();
        await expect(api.hasPendingInstall()).resolves.toBe(false);
    });
});
