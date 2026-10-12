import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** The background copy of a recording in IndexedDB must always settle.
 *
 * The offscreen document keeps the recording, and stays open, until the page
 * has it, the upload is done and that copy is written or has failed. A full
 * disk aborts the write's transaction rather than failing a request, and an
 * abort was not listened for: the copy never settled, so the document — and
 * a recording of any size in memory — stayed for good. */

const MB = 1024 * 1024;
let h;
afterEach(() => h?.dispose());

/** Writes to the recordings store end the way `how` says; reads and every
 * other database are untouched. */
function breakParking(how) {
    h.offscreen(`(() => {
        const real = indexedDB;
        const how = ${JSON.stringify(how)};
        globalThis.indexedDB = {
            open(name, version) {
                const req = real.open(name, version);
                if (name !== 'SnapRecDB') return req;
                const wrapped = {};
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const fakeDb = new Proxy(db, { get(t, k) {
                        if (k !== 'transaction') { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }
                        return (stores, mode) => {
                            if (mode !== 'readwrite') return t.transaction(stores, mode);
                            const tx = { objectStore: () => ({ put() {} }), abort() {} };
                            if (how === 'abort') setTimeout(() => tx.onabort?.({ target: tx }), 0);
                            return tx;
                        };
                    } });
                    wrapped.onsuccess?.({ target: { result: fakeDb } });
                };
                req.onerror = (e) => wrapped.onerror?.(e);
                req.onupgradeneeded = (e) => wrapped.onupgradeneeded?.(e);
                return wrapped;
            },
        };
    })()`);
}

async function recordStopDeliver(how) {
    await h.sw('startRecording({ microphone: false, systemAudio: false })');
    await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'the recorder' });
    breakParking(how);
    await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'the upload' });
    for (let i = 0; i < 6; i++) { h.recorder().emit(MB); await h.settle(15); }
    void h.fromContent({ action: 'stopRecording' }).catch(() => {});
    await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
    const id = new URL(h.tabs.find((t) => t.url.includes('/v')).url).searchParams.get('r');
    const courier = h.channel('snaprec-handoff');
    courier.postMessage({ type: 'want', id });
    await h.waitFor(() => courier.received.some((m) => m.type === 'recording'), { what: 'the recording' });
    courier.postMessage({ type: 'delivered', id });
    await h.waitFor(() => h.channelLog.some((m) => m.data.type === 'progress' && m.data.state === 'registered'), { what: 'registration' });
    return courier;
}

describe('the background copy', () => {
    it('settles when its transaction is aborted (a full disk), and the document closes', async () => {
        h = createHarness({ tabLoadMs: 0 });
        const courier = await recordStopDeliver('abort');
        await h.waitFor(() => courier.received.some((m) => m.type === 'saved'), { what: 'the save result' });
        expect(courier.received.find((m) => m.type === 'saved')).toMatchObject({ ok: false });
        await h.waitFor(() => h.contexts.offscreen?.alive === false, { what: 'the document to close', timeout: 5000 });
        courier.close();
    }, 30_000);

    it('gives up on a write that never answers, and the document closes', async () => {
        h = createHarness({ tabLoadMs: 0 });
        const courier = await recordStopDeliver('hang');
        // PARK_TIMEOUT_MS (5 min) is 3 s at the harness's time scale.
        await h.waitFor(() => h.contexts.offscreen?.alive === false, { what: 'the document to close', timeout: 8000 });
        courier.close();
    }, 30_000);
});

describe('the disk fallback from the background copy', () => {
    /* When the document no longer holds a recording the page never took,
     * the worker saves it from the IndexedDB copy. That slot holds the most
     * recent recording, which may be a newer one: saving that under this
     * recording's failure would put the wrong recording in Downloads.
     *
     * Checked on the loader itself: the harness's IndexedDB does not keep a
     * Blob as a Blob, so the save to Downloads cannot be followed end to end
     * here. */
    it('loads only the recording it was asked for', async () => {
        h = createHarness({ tabLoadMs: 0 });
        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'the recorder' });
        await h.offscreen(`persistForHandoff('rec-NEWER', '[]', 'video', new Blob(['newer']))`);
        const asked = (id) => h.offscreen(`loadParkedBlob('video', ${JSON.stringify(id)}).then(() => 'loaded', (e) => e.message)`);
        expect(await asked('rec-A')).toBe('another recording is parked');
        expect(await asked('rec-NEWER')).not.toBe('another recording is parked');
    }, 30_000);

    it('the worker asks for the recording that was not delivered', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync(`${__dirname}/../background/background.js`, 'utf8');
        expect(src).toMatch(/action: 'offscreen_loadParked', kind, id \}/);
    });
});
