import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

/** background/analytics.js is a classic script loaded via importScripts, so it
 * is evaluated in a VM with a fake `chrome` rather than imported. That also
 * proves it does not reach for `window`, `document` or `localStorage` — the
 * three things a Manifest V3 service worker does not have, and the reason
 * posthog-js cannot be used here. */
function load({ key = 'phc_test', optedOut = false, fetchImpl } = {}) {
    const store = { analyticsOptOut: optedOut };
    const calls = [];

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        // A service worker has URL and Date; the bare VM context does not.
        URL,
        Date,
        JSON,
        CONFIG: { POSTHOG: { KEY: key, HOST: 'https://us.i.posthog.com' } },
        crypto: { randomUUID: () => 'uuid-fixed' },
        chrome: {
            runtime: { getManifest: () => ({ version: '9.9.9' }) },
            storage: {
                local: {
                    get: async (k) => {
                        const keys = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
                        const out = {};
                        for (const key of keys) if (key in store) out[key] = store[key];
                        return out;
                    },
                    set: async (obj) => { Object.assign(store, obj); },
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
    return { api: sandbox.Analytics, calls, store, sandbox };
}

describe('extension analytics client', () => {
    it('posts to the documented PostHog capture endpoint', async () => {
        const { api, calls } = load();
        await api.track('recording_started', { format: 'video/webm' });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://us.i.posthog.com/i/v0/e');
        expect(calls[0].body).toMatchObject({
            api_key: 'phc_test',
            event: 'recording_started',
            distinct_id: 'uuid-fixed',
        });
        expect(calls[0].body.properties.format).toBe('video/webm');
        expect(calls[0].body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('stamps the extension version on every event', async () => {
        const { api, calls } = load();
        await api.track('screenshot_taken');
        expect(calls[0].body.properties.extension_version).toBe('9.9.9');
    });

    /* The key is deliberately empty in config.js. Nothing should be sent, and
     * nothing should throw, until someone fills it in. */
    it('is completely inert with no API key', async () => {
        const { api, calls } = load({ key: '' });
        await expect(api.track('recording_started')).resolves.toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('sends nothing once opted out', async () => {
        const { api, calls } = load({ optedOut: true });
        await expect(api.track('recording_started')).resolves.toBe(false);
        expect(calls).toHaveLength(0);
    });

    it('stops and resumes on opt out / opt in', async () => {
        const { api, calls } = load();
        await api.optOut();
        await api.track('screenshot_taken');
        expect(calls).toHaveLength(0);

        await api.optIn();
        await api.track('screenshot_taken');
        expect(calls).toHaveLength(1);
    });

    it('reuses one install id across events', async () => {
        const { api, calls, store } = load();
        await api.track('a');
        await api.track('b');
        expect(calls[0].body.distinct_id).toBe(calls[1].body.distinct_id);
        expect(store.analyticsDistinctId).toBe('uuid-fixed');
    });

    /* The whole point of fire-and-forget: an offline user must be unaffected. */
    it('resolves false instead of rejecting when the network fails', async () => {
        const { api } = load({ fetchImpl: () => Promise.reject(new Error('offline')) });
        await expect(api.track('recording_started')).resolves.toBe(false);
    });

    it('resolves false on a non-2xx response', async () => {
        const { api } = load({ fetchImpl: async () => ({ ok: false, status: 500 }) });
        await expect(api.track('recording_started')).resolves.toBe(false);
    });

    it('never rejects, whatever fetch throws synchronously', async () => {
        const { api } = load({ fetchImpl: () => { throw new Error('boom'); } });
        await expect(api.track('recording_started')).resolves.toBe(false);
    });

    /** A tab URL can carry document names, ticket ids and tokens. Only the host
     * is ever sent. */
    describe('domainOf', () => {
        it('keeps only the hostname', () => {
            const { api } = load();
            expect(api.domainOf('https://docs.google.com/document/d/SECRET/edit?token=abc'))
                .toBe('docs.google.com');
        });

        it('returns null for non-web and unparseable URLs', () => {
            const { api } = load();
            for (const url of ['chrome://extensions', 'file:///Users/me/secret.pdf', 'not a url', undefined]) {
                expect(api.domainOf(url), String(url)).toBeNull();
            }
        });
    });
});

/* The popup's opt-out switch. A privacy control that looks like it works and
 * does not is worse than no control, so this covers the whole round trip:
 * default state, the reducer, and the inversion between the user-facing
 * `analytics` flag and the stored `analyticsOptOut` flag. */
describe('popup analytics opt-out switch', () => {
    it('defaults to sharing enabled, matching the opt-out model', async () => {
        const { initialState } = await import('../popup/state.js');
        expect(initialState().options.analytics).toBe(true);
    });

    it('flips through the existing TOGGLE_OPTION reducer', async () => {
        const { initialState, transition } = await import('../popup/state.js');
        const off = transition(initialState(), { type: 'TOGGLE_OPTION', key: 'analytics' });
        expect(off.options.analytics).toBe(false);

        const backOn = transition(off, { type: 'TOGGLE_OPTION', key: 'analytics' });
        expect(backOn.options.analytics).toBe(true);
    });

    it('leaves the other options untouched when toggled', async () => {
        const { initialState, transition } = await import('../popup/state.js');
        const before = initialState();
        const after = transition(before, { type: 'TOGGLE_OPTION', key: 'analytics' });
        expect(after.options.resolution).toBe(before.options.resolution);
        expect(after.options.autoZoom).toBe(before.options.autoZoom);
        expect(after.options.cursor).toBe(before.options.cursor);
    });

    it('renders a switch bound to the flag', async () => {
        const { initialState } = await import('../popup/state.js');
        const { render } = await import('../popup/render.js');
        document.body.innerHTML = '<div id="root"></div>';
        render({ ...initialState(), view: 'options' }, () => {}, { captureScreenshot() {} });

        const sw = document.querySelector('[data-option-toggle="analytics"]');
        expect(sw).toBeTruthy();
        expect(sw.getAttribute('role')).toBe('switch');
        expect(sw.getAttribute('aria-checked')).toBe('true');
    });

    it('shows the switch off once the user has opted out', async () => {
        const { initialState } = await import('../popup/state.js');
        const { render } = await import('../popup/render.js');
        document.body.innerHTML = '<div id="root"></div>';
        const state = initialState();
        render({ ...state, view: 'options', options: { ...state.options, analytics: false } },
            () => {}, { captureScreenshot() {} });

        expect(document.querySelector('[data-option-toggle="analytics"]').getAttribute('aria-checked'))
            .toBe('false');
    });

    /* The stored flag is the inverse of the switch, and popup.js is what
     * inverts it. Guard the direction — getting this backwards would silently
     * enable analytics for everyone who turned it off. */
    it('popup.js stores the inverse of the user-facing flag', () => {
        const src = readFileSync(resolve(__dirname, '../popup/popup.js'), 'utf8');
        expect(src).toContain("setOptOut(!state.options.analytics)");
        const boot = readFileSync(resolve(__dirname, '../popup/popup.js'), 'utf8');
        expect(boot).toContain('analytics: !optedOut');
    });
});

/* The popup -> background bridge. This is the link between the switch and the
 * stored flag; if the message shape is wrong the toggle silently does nothing. */
describe('popup analytics bridge', () => {
    let sent;

    beforeEach(() => {
        sent = [];
        globalThis.chrome = {
            runtime: {
                lastError: undefined,
                sendMessage: (msg, cb) => {
                    sent.push(msg);
                    if (msg.action === 'getAnalyticsOptOut') cb?.({ optedOut: true });
                    else cb?.({ ok: true });
                },
            },
        };
    });

    it('sends the event to the background rather than capturing locally', async () => {
        const { track } = await import('../popup/analytics.js');
        track('recording_started', { format: 'video/webm' });
        expect(sent).toEqual([{
            action: 'trackEvent',
            event: 'recording_started',
            properties: { format: 'video/webm' },
        }]);
    });

    it('sends the opt-out flag in the direction the background expects', async () => {
        const { setOptOut } = await import('../popup/analytics.js');
        await setOptOut(true);
        expect(sent).toEqual([{ action: 'setAnalyticsOptOut', optOut: true }]);
    });

    it('reads the stored preference back', async () => {
        const { getOptOut } = await import('../popup/analytics.js');
        await expect(getOptOut()).resolves.toBe(true);
    });

    /* The popup can be closed mid-send; that must not throw into a click. */
    it('swallows a dead message channel', async () => {
        globalThis.chrome.runtime.sendMessage = () => { throw new Error('no receiver'); };
        const { track, getOptOut } = await import('../popup/analytics.js');
        expect(() => track('screenshot_taken')).not.toThrow();
        await expect(getOptOut()).resolves.toBe(true);
    });
});
