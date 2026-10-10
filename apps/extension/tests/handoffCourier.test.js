import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
// The Blob the fake IndexedDB hands back is Node's, not jsdom's; a browser has
// one Blob, so the courier's instanceof check must see the same class here.
import { Blob as NodeBlob } from 'node:buffer';

/** The handoff courier delivers only the capture it was sent for.
 *
 * One IndexedDB slot holds the latest capture. When a capture's save failed,
 * or a newer recording replaced it before its page loaded, the slot holds a
 * different recording — which the courier used to deliver anyway, and then,
 * unacknowledged, report as a failed handoff, so the disk fallback saved the
 * wrong recording too. */

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

function runCourier(idb, frameId) {
    const posted = [];
    const sent = [];
    const listeners = [];
    const sandbox = {
        console: { log() {}, warn() {}, error: (...a) => { if (process.env.DEBUG_COURIER) process.stdout.write('COURIER ' + a.join(' ') + '\n'); } },
        URLSearchParams, Blob: NodeBlob, Promise, Error, setTimeout: (fn) => setTimeout(fn, 0),
        location: { search: `?id=${frameId}` },
        indexedDB: idb,
        CONFIG: { WEB_BASE_URL: 'https://web.test' },
        parent: { postMessage: (msg, origin) => posted.push({ msg, origin }) },
        chrome: { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } },
        window: { addEventListener: (type, fn) => listeners.push(fn) },
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../handoff/handoff.js'), 'utf8'), sandbox);
    return { posted, sent, ack: (id) => listeners.forEach((fn) => fn({ data: { type: 'SNAPREC_HANDOFF_ACK', id } })) };
}

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
afterEach(() => vi.restoreAllMocks());

describe('the handoff courier', () => {
    it('delivers the capture it was sent for', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-A' });
        const c = runCourier(idb, 'rec-A');
        await settle(20);
        c.ack('rec-A');
        await settle();
        expect(c.posted[0]).toMatchObject({ msg: { type: 'SNAPREC_VIDEO_DATA', id: 'rec-A' }, origin: 'https://web.test' });
        expect(c.posted[0].msg.blob).toBeInstanceOf(NodeBlob);
    });

    it('does not deliver another recording that happens to be in the slot, nor report a failed handoff', async () => {
        const idb = new IDBFactory();
        await park(idb, { id: 'rec-OLD' });           // the save for rec-NEW never happened
        const c = runCourier(idb, 'rec-NEW');
        await settle(200);
        expect(c.posted).toEqual([]);
        expect(c.sent).toEqual([]);                     // no handoffFailed: the disk fallback would save rec-OLD
    });
});
