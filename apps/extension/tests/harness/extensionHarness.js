/** Runs the real service worker and the real offscreen document side by side.
 *
 * Each context is its own vm sandbox loaded from the files Chrome would load —
 * background.js through importScripts, the offscreen document through the
 * <script> tags in offscreen.html — joined by a chrome.runtime message bus.
 * What they share is what Chrome shares between them: chrome.storage and the
 * extension origin's IndexedDB. Nothing else.
 *
 * That separation is the point. terminateWorker() throws the worker's sandbox
 * away, exactly as Chrome does after 30 seconds without an event, and the next
 * message boots a fresh one from the same files. Any state that lived only in
 * the worker's globals is gone, and a test can see whether the recording
 * survived that. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

const ROOT = resolve(__dirname, '../..');
const API = 'https://api.test';
const R2 = 'https://r2.test';
const POSTHOG = 'https://posthog.test';
/** Timers run this many times faster than written. Scaled rather than capped,
 * so every timeout keeps its proportion to the others — a cap made a
 * 200-second guard fire as soon as a 1-second backoff. */
const TIME_SCALE = 100;

function makeEvent() {
    const listeners = [];
    return {
        listeners,
        addListener: (fn) => { listeners.push(fn); },
        removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
        hasListener: (fn) => listeners.includes(fn),
    };
}

/** Anything the scenario does not exercise: callable, awaitable, and with
 * addListener, so top-level registration in background.js succeeds. */
function inert() {
    const target = function () { return Promise.resolve(undefined); };
    return new Proxy(target, {
        get(t, prop) {
            if (prop === 'then') return undefined;
            if (prop === 'addListener' || prop === 'removeListener') return () => {};
            if (prop === 'hasListener') return () => false;
            if (!(prop in t)) t[prop] = inert();
            return t[prop];
        },
    });
}

function storageArea(map) {
    const keysOf = (k) => (k == null ? [...map.keys()]
        : typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k));
    return {
        get: async (k) => {
            const out = {};
            if (k && typeof k === 'object' && !Array.isArray(k)) Object.assign(out, k);
            for (const key of keysOf(k)) if (map.has(key)) out[key] = structuredClone(map.get(key));
            return out;
        },
        set: async (obj) => { for (const [k, v] of Object.entries(obj)) map.set(k, structuredClone(v)); },
        remove: async (k) => { for (const key of (Array.isArray(k) ? k : [k])) map.delete(key); },
        clear: async () => { map.clear(); },
    };
}

/** `tabLoadMs`: how long a new tab takes to report "complete". A page that
 * loads faster than the extension finishes parking a capture is the race
 * behind "the share page never got the recording". */
/** `byteScale`: each real byte stands for this many, so a multi-gigabyte
 * recording runs in megabytes: parts are cut at 5 MB / byteScale, and the
 * upload bandwidth model counts bytes * byteScale. */
export function createHarness({ log = false, tabLoadMs = 5, byteScale = 1, injectionFails = false } = {}) {
    const shared = {
        local: new Map(),
        session: new Map(),
        idb: new IDBFactory(),
    };
    /* `uploadBps`: R2 part uploads take bytes * 8 / uploadBps seconds of
     * (scaled) time, one at a time, as on a real uplink. Null: instant. */
    const net = { calls: [], failNext: {}, offline: false, hang: null, uploads: new Map(), rows: new Map(), refusedTokens: new Set(), uploadBps: null };
    const notifications = [];
    /** Every handoff-frame injection: which tab, which frame URL, and whether
     * a capture was parked under that id at the moment it was injected. */
    const injections = [];
    const downloads = [];
    const parkedId = () => new Promise((resolve) => {
        const request = shared.idb.open('SnapRecDB', 2);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore('recordings');
        request.onsuccess = (e) => {
            const get = e.target.result.transaction(['recordings']).objectStore('recordings').get('latest_id');
            get.onsuccess = () => resolve(get.result ?? null);
            get.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
    });
    const contexts = {};      // name -> { sandbox, listeners, timers, alive }
    /** BroadcastChannel among this harness's contexts only. Messages arrive
     * on a later turn, as in Chrome, and never at a context that has died. */
    const channels = new Map();   // name -> Set of { owner, instance }
    const channelLog = [];        // every broadcast: { name, data }
    function broadcastChannelFor(ctx) {
        return class BroadcastChannel {
            constructor(name) {
                this.name = name; this.onmessage = null; this.closed = false;
                if (!channels.has(name)) channels.set(name, new Set());
                this.entry = { owner: ctx, instance: this };
                channels.get(name).add(this.entry);
            }
            postMessage(data) {
                if (this.closed || !ctx.alive) return;
                channelLog.push({ name: this.name, data });
                for (const { owner, instance } of channels.get(this.name)) {
                    if (instance === this || instance.closed) continue;
                    setTimeout(() => { if (owner.alive && !instance.closed) instance.onmessage?.({ data }); }, 0);
                }
            }
            close() { this.closed = true; channels.get(this.name)?.delete(this.entry); }
        };
    }
    let tabSeq = 100;
    const tabs = [];

    /* ---- network: the API, R2 and PostHog, as the extension sees them ---- */
    async function fetchImpl(input, init = {}) {
        const url = String(input);
        const method = (init.method || 'GET').toUpperCase();
        let body = init.body;
        const call = { url, method };
        net.calls.push(call);

        if (url.startsWith(POSTHOG)) {
            call.event = JSON.parse(body);
            return new Response('{}', { status: 200 });
        }
        if (net.offline) throw new TypeError('Failed to fetch');
        // A request that is never answered: a black-holed connection.
        // Never answered, but cancellable, as a real fetch is.
        if (net.hang && url.includes(net.hang)) {
            return new Promise((_, reject) => init.signal?.addEventListener('abort',
                () => reject(init.signal.reason ?? new Error('aborted')), { once: true }));
        }
        for (const [pattern, n] of Object.entries(net.failNext)) {
            if (n > 0 && url.includes(pattern)) {
                net.failNext[pattern] = n - 1;
                call.status = 500;
                return new Response('{"message":"stubbed failure"}', { status: 500 });
            }
        }

        const json = (obj, status = 200) => { call.status = status; return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); };
        if (url.startsWith(R2) && method === 'PUT') {
            const [uploadId, partNumber] = new URL(url).pathname.split('/').filter(Boolean);
            const size = body?.size ?? body?.byteLength ?? 0;
            if (net.uploadBps) {
                const ms = (size * byteScale * 8 / net.uploadBps) * 1000 / TIME_SCALE;
                await new Promise((r) => setTimeout(r, ms));
                if (net.offline) throw new TypeError('Failed to fetch');
            }
            call.partNumber = Number(partNumber); call.bytes = size;
            const up = net.uploads.get(uploadId);
            if (!up) return json({ message: 'NoSuchUpload' }, 404);
            up.parts.set(Number(partNumber), size);
            call.status = 200;
            return new Response('', { status: 200, headers: { ETag: `"etag-${partNumber}-${size}"` } });
        }
        if (!url.startsWith(API)) return json({ message: 'not found' }, 404);

        const path = url.slice(API.length);
        body = body ? JSON.parse(body) : {};
        call.body = body;
        if (path === '/recordings/upload/begin') {
            const uploadId = `up-${net.uploads.size + 1}`;
            net.uploads.set(uploadId, { fileName: body.fileName, parts: new Map(), state: 'open' });
            return json({ uploadId, fileName: body.fileName });
        }
        if (path === '/recordings/upload/part') {
            if (!net.uploads.get(body.uploadId)) return json({ message: 'NoSuchUpload' }, 404);
            return json({ uploadUrl: `${R2}/${body.uploadId}/${body.partNumber}` });
        }
        if (path === '/recordings/upload/complete') {
            const up = net.uploads.get(body.uploadId);
            // The real controller has no catch here: R2's NoSuchUpload (already
            // completed, aborted, or swept by the lifecycle rule) surfaces as a 500.
            if (!up || up.state !== 'open') return json({ statusCode: 500, message: 'Internal server error' }, 500);
            up.state = 'complete';
            up.completedParts = body.parts.map((p) => p.PartNumber);
            up.bytes = up.completedParts.reduce((n, p) => n + (up.parts.get(p) ?? 0), 0);
            return json({ fileUrl: up.fileName });
        }
        if (path === '/recordings/upload/abort') {
            const up = net.uploads.get(body.uploadId);
            if (up) up.state = 'aborted';
            return json({ ok: true });
        }
        if (path.startsWith('/recordings/status/') && method === 'GET') {
            const fileName = decodeURIComponent(path.slice('/recordings/status/'.length));
            return json({ ready: [...net.uploads.values()].some((u) => u.fileName === fileName && u.state === 'complete') });
        }
        // A token the server no longer accepts: 401, as OptionalJwtAuthGuard answers.
        const bearer = (init.headers?.Authorization ?? '').replace(/^Bearer /, '');
        call.authorization = bearer || null;
        if (bearer && net.refusedTokens.has(bearer)) return json({ statusCode: 401, message: 'Your session has expired. Sign in again.' }, 401);
        if (path === '/recordings' && method === 'POST') {
            // Insert-only, as the server is: 200 hands an existing row back to
            // the same guest re-posting the same file; anything else is 409.
            const id = body.id ?? `rec-${net.rows.size + 1}`;
            const existing = net.rows.get(id);
            if (existing) {
                const retry = !existing.userId && existing.guestId === body.guestId && existing.fileUrl === body.fileUrl;
                return retry ? json(existing, 200) : json({ statusCode: 409, message: 'A recording with this id already exists' }, 409);
            }
            const row = { ...body, id };
            net.rows.set(id, row);
            return json(row, 201);
        }
        return json({ message: 'not found' }, 404);
    }

    /* ---- chrome.runtime message bus ---- */
    function deliver(from, message, sender) {
        if (from !== 'sw' && !contexts.sw?.alive) bootWorker();
        const targets = Object.entries(contexts)
            .filter(([name, c]) => name !== from && c.alive)
            .flatMap(([, c]) => c.listeners.onMessage.listeners.map((fn) => ({ fn, c })));
        if (targets.length === 0) {
            return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
        }
        return new Promise((resolvePromise, reject) => {
            let settled = false; let waiting = 0;
            const respond = (r) => { if (!settled) { settled = true; resolvePromise(r); } };
            setTimeout(() => {
                for (const { fn, c } of targets) {
                    if (!c.alive) continue;
                    let ret;
                    try { ret = fn(message, sender, respond); } catch (e) { if (log) console.error(e); }
                    if (ret === true) {
                        waiting++;
                        c.pendingResponders.push(() => { if (!settled) { settled = true; reject(new Error('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received')); } });
                    }
                }
                if (!settled && waiting === 0) respond(undefined);
            }, 0);
        });
    }

    function makeChrome(name) {
        const ctx = contexts[name];
        const runtimeSend = (...args) => {
            const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
            const message = args.length === 2 ? args[1] : args[0];
            if (!ctx.alive) return cb ? undefined : Promise.reject(new Error('Extension context invalidated.'));
            const p = deliver(name, message, { id: 'ext', url: `chrome-extension://ext/${name}` });
            if (cb) { p.then(cb, () => cb(undefined)); return undefined; }
            return p;
        };
        const base = {
            runtime: {
                id: 'ext',
                lastError: undefined,
                sendMessage: runtimeSend,
                onMessage: ctx.listeners.onMessage,
                onMessageExternal: makeEvent(),
                onInstalled: makeEvent(),
                onStartup: makeEvent(),
                onSuspend: makeEvent(),
                onConnect: makeEvent(),
                getManifest: () => JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8')),
                getURL: (p) => `chrome-extension://ext/${p}`,
                getContexts: async ({ contextTypes } = {}) => (
                    contextTypes?.includes('OFFSCREEN_DOCUMENT') && contexts.offscreen?.alive
                        ? [{ contextType: 'OFFSCREEN_DOCUMENT', documentUrl: 'chrome-extension://ext/offscreen/offscreen.html' }]
                        : []),
                setUninstallURL: async () => {},
            },
        };
        if (name === 'offscreen') return base; // offscreen documents get chrome.runtime and nothing else
        const tabsEvents = { onUpdated: makeEvent(), onActivated: makeEvent(), onRemoved: makeEvent() };
        ctx.tabsEvents = tabsEvents;
        return {
            ...base,
            storage: { local: storageArea(shared.local), session: storageArea(shared.session), onChanged: makeEvent() },
            offscreen: {
                Reason: { DISPLAY_MEDIA: 'DISPLAY_MEDIA', USER_MEDIA: 'USER_MEDIA', BLOBS: 'BLOBS' },
                createDocument: async () => {
                    if (contexts.offscreen?.alive) throw new Error('Only a single offscreen document may be created.');
                    bootOffscreen();
                },
                closeDocument: async () => { killOffscreen(); },
            },
            tabs: {
                ...tabsEvents,
                query: async () => [{ id: 1, url: 'https://example.com/', active: true, windowId: 1 }, ...tabs],
                get: async (id) => {
                    const tab = tabs.find((t) => t.id === id);
                    if (tab) return { ...tab };
                    if (id === 1) return { id, url: 'https://example.com/', status: 'complete' };
                    throw new Error(`No tab with id: ${id}.`);
                },
                create: async ({ url }) => {
                    const tab = { id: ++tabSeq, url, status: 'loading', windowId: 1 };
                    tabs.push(tab);
                    setTimeout(() => {
                        if (tab.removed) return;
                        tab.status = 'complete';
                        for (const c of Object.values(contexts)) {
                            if (c.alive && c.tabsEvents) c.tabsEvents.onUpdated.listeners.slice().forEach((fn) => fn(tab.id, { status: 'complete' }, tab));
                        }
                    }, tabLoadMs);
                    return { ...tab };
                },
                remove: async (id) => {
                    const tab = tabs.find((t) => t.id === id);
                    if (!tab) return;
                    tab.removed = true;
                    tabs.splice(tabs.indexOf(tab), 1);
                    for (const c of Object.values(contexts)) {
                        if (c.alive && c.tabsEvents) c.tabsEvents.onRemoved.listeners.slice().forEach((fn) => fn(id, {}));
                    }
                },
                sendMessage: (...args) => { const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null; if (cb) { cb(undefined); return undefined; } return Promise.resolve(undefined); },
                captureVisibleTab: async () => 'data:image/png;base64,',
            },
            scripting: {
                executeScript: async (details) => {
                    const frameUrl = details.args?.[0];
                    if (typeof frameUrl === 'string' && frameUrl.includes('handoff/handoff.html')) {
                        // A tab that navigated somewhere scripts cannot run.
                        if (injectionFails) throw new Error('Cannot access contents of the page.');
                        const wanted = new URL(frameUrl).searchParams.get('id');
                        injections.push({ tabId: details.target.tabId, frameUrl, parkedAtInjection: (await parkedId()) === wanted });
                    }
                    return [{ result: undefined }];
                },
                insertCSS: async () => {},
            },
            notifications: {
                create: (...a) => {
                    const id = typeof a[0] === 'string' ? a[0] : `n${notifications.length + 1}`;
                    const options = a.find((x) => x && typeof x === 'object');
                    notifications.push({ id, ...options });
                    a.find((x) => typeof x === 'function')?.(id);
                },
                clear: async () => {}, onClicked: makeEvent(), onButtonClicked: makeEvent(),
            },
            downloads: (() => {
                const onChanged = makeEvent();
                return {
                    onChanged,
                    // Starts, then reports "complete" a moment later, as Chrome does.
                    download: (opts, cb) => {
                        const id = downloads.length + 1;
                        downloads.push({ id, ...opts });
                        cb?.(id);
                        setTimeout(() => onChanged.listeners.slice().forEach((fn) => fn({ id, state: { current: 'complete' } })), 1);
                    },
                };
            })(),
            alarms: { create: () => {}, clear: async () => true, get: async () => undefined, onAlarm: makeEvent() },
            contextMenus: inert(),
            commands: inert(),
            action: inert(),
            identity: inert(),
        };
    }

    /* ---- sandboxes ---- */
    function makeSandbox(name) {
        const ctx = { name, alive: true, timers: new Set(), listeners: { onMessage: makeEvent() }, pendingResponders: [] };
        contexts[name] = ctx;
        const tracked = (setter, clearer) => [
            (fn, ms = 0, ...a) => {
                const id = setter(() => { ctx.timers.delete(id); if (ctx.alive) fn(...a); }, ms / TIME_SCALE);
                ctx.timers.add(id); return id;
            },
            (id) => { ctx.timers.delete(id); clearer(id); },
        ];
        const [st, ct] = tracked(setTimeout, clearTimeout);
        const [si, ci] = [
            (fn, ms = 0, ...a) => { const id = setInterval(() => { if (ctx.alive) fn(...a); }, Math.max(ms, 50)); ctx.timers.add(id); return id; },
            (id) => { ctx.timers.delete(id); clearInterval(id); },
        ];
        const quiet = { log: () => {}, info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };
        const sandbox = {
            console: log ? console : quiet,
            setTimeout: st, clearTimeout: ct, setInterval: si, clearInterval: ci,
            queueMicrotask, structuredClone,
            Blob, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal,
            Promise, Date, Math, JSON, Error, TypeError, Array, Uint8Array, ArrayBuffer, Map, Set, Number, String, Object, Symbol, Reflect,
            crypto: webcrypto,
            fetch: fetchImpl,
            indexedDB: shared.idb, IDBKeyRange,
            performance: { now: () => Date.now() },
            navigator: {},
            addEventListener: () => {},
            removeEventListener: () => {},
        };
        sandbox.BroadcastChannel = broadcastChannelFor(ctx);
        sandbox.globalThis = sandbox;
        sandbox.self = sandbox;
        vm.createContext(sandbox);
        sandbox.chrome = makeChrome(name);
        ctx.sandbox = sandbox;
        return ctx;
    }

    function runFile(ctx, file) {
        let code = readFileSync(file, 'utf8');
        if (byteScale !== 1 && file.endsWith('/upload-parts.js')) {
            const scaled = code.replace('const PART_MIN_BYTES = 5 * 1024 * 1024;',
                `const PART_MIN_BYTES = ${Math.round((5 * 1024 * 1024) / byteScale)};`);
            if (scaled === code) throw new Error('harness: PART_MIN_BYTES not found to scale');
            code = scaled;
        }
        vm.runInContext(code, ctx.sandbox, { filename: file });
    }

    function bootWorker() {
        const ctx = makeSandbox('sw');
        const dir = resolve(ROOT, 'background');
        ctx.sandbox.importScripts = (...files) => files.forEach((f) => loadScript(ctx, resolve(dir, f)));
        loadScript(ctx, resolve(dir, 'background.js'));
        return ctx;
    }

    /** config.js is loaded as shipped, then pointed at the stub servers. */
    function loadScript(ctx, file) {
        runFile(ctx, file);
        if (file.endsWith('/background/config.js')) {
            vm.runInContext(`CONFIG.API_BASE_URL = '${API}'; CONFIG.WEB_BASE_URL = 'https://web.test'; CONFIG.POSTHOG.HOST = '${POSTHOG}';`, ctx.sandbox);
        }
    }

    /* MediaStream / MediaRecorder stand-ins. The recorder is driven by the
     * test: emit() is one timeslice's ondataavailable. */
    function mediaGlobals(sandbox) {
        class FakeTrack {
            constructor(kind) { this.kind = kind; this.readyState = 'live'; this.enabled = true; this.onended = null; }
            stop() { this.readyState = 'ended'; }
        }
        class FakeStream {
            constructor(tracks = []) { this.tracks = [...tracks]; }
            getTracks() { return this.tracks; }
            getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
            getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
        }
        class FakeRecorder {
            static isTypeSupported() { return true; }
            constructor(stream, opts) { this.stream = stream; this.mimeType = opts?.mimeType ?? 'video/webm'; this.state = 'inactive'; sandbox.__recorder = this; }
            start() { this.state = 'recording'; }
            pause() { this.state = 'paused'; }
            resume() { this.state = 'recording'; }
            stop() {
                this.state = 'inactive';
                setTimeout(() => this.onstop?.(), 0);
            }
            emit(bytes) { this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) }); }
        }
        sandbox.MediaStream = FakeStream;
        sandbox.MediaRecorder = FakeRecorder;
        sandbox.navigator = {
            mediaDevices: {
                getDisplayMedia: async () => new FakeStream([new FakeTrack('video')]),
                getUserMedia: async () => new FakeStream([new FakeTrack('audio')]),
            },
        };
        sandbox.URL = Object.assign(Object.create(URL), URL, { createObjectURL: () => 'blob:chrome-extension://ext/x', revokeObjectURL: () => {} });
        sandbox.document = { createElement: () => ({ getContext: () => ({}) }) };
    }

    function bootOffscreen() {
        const ctx = makeSandbox('offscreen');
        mediaGlobals(ctx.sandbox);
        const dir = resolve(ROOT, 'offscreen');
        const html = readFileSync(resolve(dir, 'offscreen.html'), 'utf8');
        const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
        for (const src of srcs) loadScript(ctx, resolve(dir, src));
        return ctx;
    }

    function kill(name) {
        const ctx = contexts[name];
        if (!ctx || !ctx.alive) return;
        ctx.alive = false;
        for (const id of ctx.timers) { clearTimeout(id); clearInterval(id); }
        ctx.timers.clear();
        ctx.pendingResponders.forEach((fail) => fail());
        ctx.pendingResponders = [];
    }
    function killOffscreen() { kill('offscreen'); }

    async function settle(ms = 60) {
        // Several macrotask turns: every hop on the bus is one setTimeout.
        const end = Date.now() + ms;
        while (Date.now() < end) await new Promise((r) => setTimeout(r, 2));
    }

    async function waitFor(pred, { timeout = 4000, what = 'condition' } = {}) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
            if (pred()) return;
            await new Promise((r) => setTimeout(r, 5));
        }
        throw new Error(`timed out waiting for ${what}`);
    }

    bootWorker();

    return {
        shared, net, contexts, tabs, notifications, injections, downloads, channelLog,
        API, R2, TIME_SCALE,
        /** A test-side BroadcastChannel: what the courier frame would open. */
        channel: (name) => {
            const testCtx = { alive: true };
            const Channel = broadcastChannelFor(testCtx);
            const c = new Channel(name);
            c.received = [];
            c.onmessage = (e) => c.received.push(e.data);
            return c;
        },
        bootWorker,
        /** What Chrome does after 30 s without an event. The next message boots a new one. */
        terminateWorker: () => kill('sw'),
        /** The offscreen document dies (renderer crash, Chrome closes it, the browser quits). */
        killOffscreen,
        sw: (expr) => vm.runInContext(expr, contexts.sw.sandbox),
        offscreen: (expr) => vm.runInContext(expr, contexts.offscreen.sandbox),
        recorder: () => contexts.offscreen?.alive ? contexts.offscreen.sandbox.__recorder : null,
        /** A message from a content script or the popup: reaches every extension context. */
        fromContent: (message) => deliver('content', message, { id: 'ext', tab: { id: 1 } }),
        events: () => net.calls.filter((c) => c.event).map((c) => c.event),
        apiCalls: (path) => net.calls.filter((c) => c.url === API + path),
        settle, waitFor,
        dispose: () => Object.keys(contexts).forEach(kill),
    };
}
