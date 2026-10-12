// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Blob as NodeBlob } from 'node:buffer';

/** The offscreen document's side of a stopped recording (handoff-host.js).
 *
 * It serves a recording only for its own id, finishes and registers the
 * upload, writes the IndexedDB copy in the background — never in the way of
 * the hand-off — and is idle only once all three are settled. */

function load() {
    const sandbox = { Promise, Map, Error, console, setTimeout };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../offscreen/handoff-host.js'), 'utf8'), sandbox);
    return sandbox.SnapRecHandoffHost;
}

function rig({ deliveryGraceMs } = {}) {
    const sent = [];
    const channel = { onmessage: null, postMessage: (m) => sent.push(m) };
    const onIdle = vi.fn();
    const host = load().createHandoffHost({ channel, onIdle, ...(deliveryGraceMs ? { deliveryGraceMs } : {}) });
    const from = (data) => channel.onmessage({ data });
    return { host, sent, onIdle, from };
}

/** A promise the test settles. */
function gate() {
    let resolve; let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

function startOne(host, { id = 'rec-A', blob = new NodeBlob(['rec']) } = {}) {
    const save = gate(); const upload = gate(); const registration = gate();
    let reportProgress;
    host.start({
        id, blob, metadataStr: '[]',
        persist: () => save.promise,
        finish: (onProgress) => { reportProgress = onProgress; return upload.promise; },
        register: () => registration.promise,
    });
    return { save, upload, registration, progress: (p) => reportProgress(p), blob };
}

describe('serving the recording', () => {
    it('to whoever asks for its id, the very same Blob', async () => {
        const { host, sent, from } = rig();
        const { blob } = startOne(host);
        from({ type: 'want', id: 'rec-A' });
        expect(sent.find((m) => m.type === 'recording')).toMatchObject({ id: 'rec-A', metadataStr: '[]' });
        expect(sent.find((m) => m.type === 'recording').blob).toBe(blob);
    });

    it('to nobody else: an unknown id, or no id, gets nothing', async () => {
        const { host, sent, from } = rig();
        startOne(host);
        from({ type: 'want', id: 'rec-B' });
        from({ type: 'want' });
        from(null);
        expect(sent.filter((m) => m.type === 'recording')).toEqual([]);
    });

    it('does not wait for the IndexedDB copy, and still serves it when that copy fails', async () => {
        const { host, sent, from } = rig();
        const one = startOne(host);
        from({ type: 'want', id: 'rec-A' });
        expect(sent.some((m) => m.type === 'recording')).toBe(true);
        one.save.reject(new Error('QuotaExceededError'));
        await flush(); await flush();
        expect(sent.find((m) => m.type === 'saved')).toEqual({ type: 'saved', id: 'rec-A', ok: false });
        from({ type: 'want', id: 'rec-A' });
        expect(sent.filter((m) => m.type === 'recording')).toHaveLength(2);
    });

    it('a late courier gets the latest progress and the save result too', async () => {
        const { host, sent, from } = rig();
        const one = startOne(host);
        await flush();   // the host starts the upload on the next turn
        one.progress({ state: 'uploading', uploadedBytes: 3, totalBytes: 9 });
        one.save.resolve();
        await flush(); await flush();
        sent.length = 0;
        from({ type: 'want', id: 'rec-A' });
        expect(sent.map((m) => m.type)).toEqual(['recording', 'progress', 'saved']);
        expect(sent[1]).toMatchObject({ state: 'uploading', uploadedBytes: 3 });
    });
});

describe('the upload', () => {
    it('relays progress, registers a finished upload, and says so', async () => {
        const { host, sent } = rig();
        const one = startOne(host);
        await flush();   // the host starts the upload on the next turn
        one.progress({ state: 'uploading', uploadedBytes: 5, totalBytes: 10 });
        one.upload.resolve({ fileUrl: 'video-x.webm', durationSec: 60 });
        await flush();
        one.registration.resolve('created');
        await flush(); await flush();
        expect(sent.filter((m) => m.type === 'progress').map((m) => m.state)).toEqual(['uploading', 'registering', 'registered']);
        expect(sent.at(-1)).toMatchObject({ state: 'registered', recordingId: 'rec-A' });
    });

    it.each([
        ['unauthorized', 'session_expired'],
        ['conflict', 'register_failed'],
        ['failed', 'register_failed'],
    ])('a registration that comes back %s is reported as failed (%s)', async (outcome, reason) => {
        const { host, sent } = rig();
        const one = startOne(host);
        one.upload.resolve({ fileUrl: 'video-x.webm', durationSec: 60 });
        await flush();
        one.registration.resolve(outcome);
        await flush(); await flush();
        expect(sent.filter((m) => m.type === 'progress').at(-1)).toMatchObject({ state: 'failed', reason });
    });

    it('an upload that ends with nothing to register is reported as failed once', async () => {
        const { host, sent } = rig();
        const one = startOne(host);
        await flush();   // the host starts the upload on the next turn
        one.progress({ state: 'failed', reason: 'stalled' });
        one.upload.resolve(null);
        await flush(); await flush();
        expect(sent.filter((m) => m.type === 'progress' && m.state === 'failed')).toEqual([
            expect.objectContaining({ reason: 'stalled' }),
        ]);
    });
});

describe('idle', () => {
    async function settleAll(one, from) {
        one.save.resolve();
        one.upload.resolve(null);
        await flush(); await flush();
        from({ type: 'delivered', id: 'rec-A' });
    }

    it('only once delivered, uploaded and saved', async () => {
        const { host, onIdle, from } = rig();
        const one = startOne(host);
        one.save.resolve();
        await flush(); await flush();
        expect(onIdle).not.toHaveBeenCalled();
        one.upload.resolve(null);
        await flush(); await flush();
        expect(onIdle).not.toHaveBeenCalled();
        from({ type: 'delivered', id: 'rec-A' });
        expect(onIdle).toHaveBeenCalledTimes(1);
        expect(host.busy()).toBe(false);
    });

    it('a recording the page never took is held until the worker has saved it to disk', async () => {
        const { host, onIdle } = rig();
        const one = startOne(host);
        one.save.resolve(); one.upload.resolve(null);
        await flush(); await flush();
        expect(host.recordingFor('rec-A')).not.toBeNull();   // the worker reads it from here
        host.handoffSettled('rec-A');
        expect(onIdle).toHaveBeenCalledTimes(1);
        expect(host.recordingFor('rec-A')).toBeNull();
    });

    it('not while another recording is still finishing', async () => {
        const { host, onIdle, from } = rig();
        const a = startOne(host, { id: 'rec-A' });
        startOne(host, { id: 'rec-B' });
        await settleAll(a, from);
        expect(onIdle).not.toHaveBeenCalled();
        expect(host.busy()).toBe(true);
    });
});

describe('a recording nobody comes for', () => {
    it('is let go after the grace period, once its upload and save have settled', async () => {
        const { host, onIdle } = rig({ deliveryGraceMs: 30 });
        const one = startOne(host);
        one.save.resolve(); one.upload.resolve(null);
        await flush(); await flush();
        expect(onIdle).not.toHaveBeenCalled();
        await new Promise((r) => setTimeout(r, 50));
        expect(onIdle).toHaveBeenCalledTimes(1);
        expect(host.busy()).toBe(false);
    });

    it('a delivered recording is not affected by the grace timer', async () => {
        const { host, onIdle, from } = rig({ deliveryGraceMs: 30 });
        const one = startOne(host);
        from({ type: 'delivered', id: 'rec-A' });
        await new Promise((r) => setTimeout(r, 50));
        expect(onIdle).not.toHaveBeenCalled();       // still uploading and saving
        one.save.resolve(); one.upload.resolve(null);
        await flush(); await flush();
        expect(onIdle).toHaveBeenCalledTimes(1);
    });
});
