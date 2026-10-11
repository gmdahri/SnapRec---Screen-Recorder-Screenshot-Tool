import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
// The Blob the fake IndexedDB hands back is Node's, not jsdom's; a browser has
// one Blob, so the courier's instanceof check must see the same class here.
import { Blob as NodeBlob } from 'node:buffer';

/** The handoff courier: the frame that hands a capture to the share page.
 *
 * It delivers only the capture it was sent for, only to a SnapRec page, and
 * listens only to that page. A recording comes from the offscreen document
 * over a BroadcastChannel; IndexedDB is the fallback.
 *
 * Timers run 20x fast: 2 s of waiting for the offscreen document is 100 ms. */

const PAGE = 'https://www.web.test';
const SPEED = 20;

function park(idb, { id, blob = new NodeBlob(['video']) }) {
    return new Promise((done) => {
        const request = idb.open('SnapRecDB', 2);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore('recordings');
        request.onsuccess = (e) => {
            const tx = e.target.result.transaction(['recordings'], 'readwrite');
            tx.objectStore('recordings').put(blob, 'latest_video_blob');
            tx.objectStore('recordings').put(id, 'latest_id');
            tx.objectStore('recordings').put('[]', 'latest_metadata');
            tx.oncomplete = () => done();
        };
    });
}

/** A BroadcastChannel pair: the courier's end, and the offscreen document's. */
function channelPair() {
    const ends = [];
    class Channel {
        constructor() { this.onmessage = null; ends.push(this); }
        postMessage(data) { for (const e of ends) if (e !== this) setTimeout(() => e.onmessage?.({ data }), 0); }
        close() {}
    }
    const host = new Channel();
    host.received = [];
    return { Channel, host };
}

function runCourier(idb, frameId, { ancestor = PAGE, channel, timeoutMs } = {}) {
    const posted = [];
    const sent = [];
    const listeners = [];
    const parent = { postMessage: (msg, origin) => posted.push({ msg, origin }) };
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        URLSearchParams, URL, Blob: NodeBlob, Promise, Error, Number, Math, Set,
        setTimeout: (fn, ms = 0) => setTimeout(fn, ms / SPEED),
        clearTimeout,
        setInterval: (fn, ms = 0) => setInterval(fn, ms / SPEED),
        clearInterval,
        location: { search: `?id=${frameId}`, ancestorOrigins: ancestor ? [ancestor] : [] },
        indexedDB: idb,
        CONFIG: { WEB_BASE_URL: PAGE, ...(timeoutMs ? { HANDOFF_TIMEOUT_MS: timeoutMs } : {}) },
        parent,
        chrome: { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } },
        window: { addEventListener: (type, fn) => listeners.push(fn) },
        ...(channel ? { BroadcastChannel: channel } : {}),
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../handoff/handoff.js'), 'utf8'), sandbox);
    const message = (data, { origin = ancestor, source = parent } = {}) =>
        listeners.forEach((fn) => fn({ data, origin, source }));
    return {
        posted, sent,
        ack: (id, opts) => message({ type: 'SNAPREC_HANDOFF_ACK', id }, opts),
        delivered: () => posted.filter((p) => p.msg.type === 'SNAPREC_VIDEO_DATA'),
    };
}

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
afterEach(() => vi.restoreAllMocks());

describe('the handoff courier', () => {
    it('delivers the capture it was sent for', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A');
        await settle(150);
        c.ack('rec-A');
        await settle();
        expect(c.delivered()[0]).toMatchObject({ msg: { type: 'SNAPREC_VIDEO_DATA', id: 'rec-A' }, origin: PAGE });
        expect(c.delivered()[0].msg.blob).toBeInstanceOf(NodeBlob);
    });

    it('does not deliver another recording that happens to be in the slot, nor report a failed handoff', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-OLD' });           // the save for rec-NEW never happened
        const c = runCourier(idb, 'rec-NEW');
        await settle(300);
        expect(c.delivered()).toEqual([]);
        expect(c.sent).toEqual([]);                     // no handoffFailed: the disk fallback would save rec-OLD
    });
});

describe('who it talks to', () => {
    it('embedded on any other site, it delivers nothing and asks for nothing', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const { Channel, host } = channelPair();
        host.onmessage = (e) => host.received.push(e.data);
        const c = runCourier(idb, 'rec-A', { ancestor: 'https://evil.test', channel: Channel });
        await settle(300);
        expect(c.posted).toEqual([]);
        expect(host.received).toEqual([]);
        expect(c.sent).toEqual([]);
    });

    it('with no ancestor origin to check, it delivers nothing', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A', { ancestor: null });
        await settle(300);
        expect(c.posted).toEqual([]);
    });

    it('accepts the bare domain as well as www., posting to the exact one it is on', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A', { ancestor: 'https://web.test' });
        await settle(150);
        expect(c.delivered()[0].origin).toBe('https://web.test');
    });

    it('ignores an acknowledgement from a wrong origin or another window, and falls back to disk', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A', { timeoutMs: 2_000 });
        await settle(30);
        c.ack('rec-A', { origin: 'https://evil.test' });
        c.ack('rec-A', { source: { postMessage() {} } });
        await settle(250);
        expect(c.sent).toEqual([{ action: 'handoffFailed', kind: 'video', id: 'rec-A' }]);
    });
});

describe('from the offscreen document', () => {
    it('takes the recording over the channel, the same Blob, without reading IndexedDB', async () => {
        const idb = new IDBFactory();                    // nothing parked at all
        const { Channel, host } = channelPair();
        const blob = new NodeBlob(['the recording']);
        host.onmessage = (e) => {
            host.received.push(e.data);
            if (e.data.type === 'want' && e.data.id === 'rec-A') host.postMessage({ type: 'recording', id: 'rec-A', blob, metadataStr: '[]' });
        };
        const c = runCourier(idb, 'rec-A', { channel: Channel });
        await settle(60);
        expect(c.delivered()[0].msg.blob).toBe(blob);
        c.ack('rec-A');
        await settle(60);
        expect(host.received.map((m) => m.type)).toEqual(['want', 'delivered']);
    });

    it('falls back to IndexedDB when the document does not answer', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const { Channel } = channelPair();               // nobody on the other end
        const c = runCourier(idb, 'rec-A', { channel: Channel });
        await settle(300);
        expect(c.delivered()[0].msg).toMatchObject({ id: 'rec-A' });
    });

    it('passes upload progress and the save result on to the page, to its exact origin', async () => {
        const idb = new IDBFactory();
        const { Channel, host } = channelPair();
        host.onmessage = (e) => {
            if (e.data.type !== 'want') return;
            host.postMessage({ type: 'recording', id: 'rec-A', blob: new NodeBlob(['x']) });
            host.postMessage({ type: 'progress', id: 'rec-A', state: 'uploading', uploadedBytes: 5, totalBytes: 10 });
            host.postMessage({ type: 'progress', id: 'rec-OTHER', state: 'uploading', uploadedBytes: 1, totalBytes: 2 });
            host.postMessage({ type: 'saved', id: 'rec-A', ok: false });
        };
        const c = runCourier(idb, 'rec-A', { channel: Channel });
        await settle(80);
        const progress = c.posted.filter((p) => p.msg.type === 'SNAPREC_UPLOAD_PROGRESS');
        expect(progress).toEqual([{ msg: { type: 'SNAPREC_UPLOAD_PROGRESS', id: 'rec-A', state: 'uploading', uploadedBytes: 5, totalBytes: 10 }, origin: PAGE }]);
        expect(c.posted.find((p) => p.msg.type === 'SNAPREC_LOCAL_SAVE')).toEqual({ msg: { type: 'SNAPREC_LOCAL_SAVE', id: 'rec-A', ok: false }, origin: PAGE });
    });
});

describe('timing', () => {
    it('tells the page the capture is coming while it is being fetched', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const { Channel } = channelPair();               // the 2 s wait for the document, then IndexedDB
        const c = runCourier(idb, 'rec-A', { channel: Channel });
        await settle(80);
        expect(c.delivered()).toEqual([]);
        expect(c.posted.filter((p) => p.msg.type === 'SNAPREC_HANDOFF_PENDING').length).toBeGreaterThan(1);
    });

    it('gives the page its whole configured time once the capture is in hand, then falls back to disk', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A', { timeoutMs: 4_000 });   // 200 ms here
        await settle(150);
        expect(c.sent).toEqual([]);
        await settle(250);
        expect(c.sent).toEqual([{ action: 'handoffFailed', kind: 'video', id: 'rec-A' }]);
    });
});
