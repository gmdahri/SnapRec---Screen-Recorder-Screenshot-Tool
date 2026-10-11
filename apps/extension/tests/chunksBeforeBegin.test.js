// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { webcrypto, randomBytes } from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import vm from 'node:vm';

/** Chunks recorded while upload/begin is still in flight must reach R2.
 *
 * MediaRecorder's first chunk carries the WebM header (EBML, 1a45dfa3). The
 * recorder starts first and the upload is opened right after it without
 * waiting, so with a 1-second timeslice any begin slower than a second has
 * chunks waiting for it. Lose them and the stored file starts mid-stream:
 * it plays nowhere, yet the upload completes and the recording registers.
 *
 * Extension v2.0.9 did exactly that — it queued chunks only once begin had
 * answered, and its streamBegin cleared the queue — and that is the known
 * issue documented at the bottom of this file. The offscreen-owned uploader
 * that replaced it starts accepting chunks synchronously in begin(). */

const PART = 64 * 1024;   // small parts keep a many-part recording cheap
const EBML = '1a45dfa3';

/** A recording's timeslices: the first starts with the EBML header. */
function timeslices(n) {
    return Array.from({ length: n }, (_, i) => {
        const b = randomBytes(20_000 + ((i * 7919) % 40_000));
        if (i === 0) Buffer.from(EBML, 'hex').copy(b);
        else if (b.subarray(0, 4).toString('hex') === EBML) b[0] = 0;
        return b;
    });
}

/** API + R2 in one: begin waits on a gate, parts are kept by number, and
 * complete assembles them the way R2 does. */
function api({ headerCheck = false } = {}) {
    const s = { parts: new Map(), object: null, completed: false, calls: [] };
    let open;
    s.beginGate = new Promise((r) => { open = r; });
    s.answerBegin = () => open();
    const json = (o) => new Response(JSON.stringify(o), { status: 200 });
    s.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.startsWith('https://r2.test/')) {
            const n = Number(new URL(u).searchParams.get('partNumber'));
            s.parts.set(n, Buffer.from(await init.body.arrayBuffer()));
            return new Response('', { status: 200, headers: { ETag: `"e${n}"` } });
        }
        const body = JSON.parse(init.body);
        s.calls.push(u.replace('https://api.test', ''));
        if (u.endsWith('/recordings/upload/begin')) { await s.beginGate; return json({ uploadId: 'up-1' }); }
        if (u.endsWith('/recordings/upload/part')) return json({ uploadUrl: `https://r2.test/obj?partNumber=${body.partNumber}` });
        if (u.endsWith('/recordings/upload/complete')) {
            const object = Buffer.concat(body.parts.map((p) => s.parts.get(p.PartNumber)));
            // The server's post-complete check: a headerless webm is deleted
            // and refused.
            if (headerCheck && object.subarray(0, 4).toString('hex') !== EBML) {
                return new Response(JSON.stringify({ statusCode: 422 }), { status: 422 });
            }
            s.object = object;
            s.completed = true;
            return json({ fileUrl: body.fileName });
        }
        return json({});
    };
    return s;
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const quiet = { log() {}, warn() {}, error() {}, info() {} };

describe('the offscreen uploader (stream-upload.js)', () => {
    function uploader(server) {
        const sandbox = {
            console: quiet, Blob: NodeBlob, AbortSignal, Promise, Error, JSON, Math, Number, String, Array, Object,
            crypto: webcrypto, setTimeout, clearTimeout,
        };
        sandbox.globalThis = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(readFileSync(resolve(__dirname, '../background/stream-upload.js'), 'utf8'), sandbox);
        return sandbox.SnapRecStreamUpload.createStreamUploader({
            apiBase: 'https://api.test', fetch: server.fetch,
            store: { list: async () => [], write: async () => {}, remove: async () => {} },
            track: () => {},
            partMinBytes: PART,
            partSliceLength: (b, isFinal) => (b <= 0 ? 0 : isFinal ? b : b >= PART ? PART : 0),
        });
    }

    it.each([1, 5, 30])('keeps the %i timeslice(s) recorded before begin answers, header first', async (early) => {
        const server = api();
        const up = uploader(server);
        const slices = timeslices(400);
        // As offscreen.js does: recorder started, begin called without awaiting.
        const began = up.begin({ contentType: 'video/webm' });
        slices.slice(0, early).forEach((b) => up.push(new NodeBlob([b])));
        server.answerBegin();
        await began;
        for (const b of slices.slice(early)) { up.push(new NodeBlob([b])); await settle(); }
        await up.finish();

        expect(server.completed).toBe(true);
        expect(server.object.subarray(0, 4).toString('hex')).toBe(EBML);
        expect(server.object.equals(Buffer.concat(slices))).toBe(true);
    });
});

/* ── Known issue: extension v2.0.9 (a0039d3) ────────────────────────────────
 * Runs that release's own offscreen.js, upload-parts.js and the upload
 * functions from its background.js, read from git. It asserts the bug, so it
 * documents what users of v2.0.9 hit until they update. The server narrows
 * the window by answering upload/begin without an R2 round trip, and refuses
 * a completed webm without its header (422), which v2.0.9 answers by
 * aborting and registering nothing. Skipped where the history is not
 * available (a shallow clone). */

const REPO = resolve(__dirname, '../../..');
function fromV209(path) {
    try {
        return execFileSync('git', ['show', `a0039d3:${path}`], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}
const v209 = {
    offscreen: fromV209('apps/extension/offscreen/offscreen.js'),
    parts: fromV209('apps/extension/background/upload-parts.js'),
    background: fromV209('apps/extension/background/background.js'),
};
const haveV209 = Object.values(v209).every(Boolean);

function v209Extension(server) {
    const parts = v209.parts.replace('const PART_MIN_BYTES = 5 * 1024 * 1024;', `const PART_MIN_BYTES = ${PART};`);
    let offscreenListener;
    let worker;
    const off = {
        console: quiet, Blob: NodeBlob, fetch: server.fetch, URL, setTimeout, clearTimeout, queueMicrotask,
        chrome: { runtime: {
            onMessage: { addListener: (fn) => { offscreenListener = fn; } },
            sendMessage: async (msg) => { if (msg.action === 'streamPartReady') void worker.uploadNextPart(false); },
        } },
        MediaRecorder: class {
            static isTypeSupported() { return true; }
            constructor() { off.recorder = this; this.state = 'inactive'; }
            start() { this.state = 'recording'; }
        },
    };
    off.globalThis = off;
    vm.createContext(off);
    vm.runInContext(parts, off);
    vm.runInContext(v209.offscreen, off);

    const bg = v209.background;
    const from = bg.indexOf('let streamingUpload = null;');
    const last = bg.indexOf('async function abortStreamingUpload()');
    const w = {
        console: quiet, fetch: server.fetch, crypto: webcrypto, setTimeout, queueMicrotask, Date, JSON,
        CONFIG: { API_BASE_URL: 'https://api.test' },
        getAuthHeaders: async () => ({}),
        getGuestId: async () => 'guest-test',
        chrome: { runtime: { sendMessage: (msg) => new Promise((done) => {
            let answered = false;
            const keepOpen = offscreenListener(msg, {}, (r) => { answered = true; done(r); });
            if (!keepOpen && !answered) done(undefined);
        }) } },
    };
    w.globalThis = w;
    vm.createContext(w);
    vm.runInContext(parts, w);
    vm.runInContext(bg.slice(from, bg.indexOf('\n}\n', last) + 3), w);
    /* handleRecordingComplete's own lines, verbatim: register only what
     * finishStreamingUpload returned. */
    const gateFrom = bg.indexOf('const streamed = await finishStreamingUpload();');
    const gate = bg.slice(gateFrom, bg.indexOf('\n        }\n', gateFrom) + 10);
    worker = {
        stopAndRegister: (recordingId) => vm.runInContext(
            `(async () => { const recordingId = ${JSON.stringify(recordingId)}; ${gate} return streamed; })()`, w),
        uploadNextPart: (isFinal) => vm.runInContext(`uploadNextPart(${isFinal})`, w),
        start: () => vm.runInContext('startStreamingUpload()', w),
        finish: () => vm.runInContext('finishStreamingUpload()', w),
        state: () => vm.runInContext('streamingUpload', w),
    };
    return {
        worker,
        startRecorder: () => vm.runInContext('pendingStream = {}; pendingVideoTracks = null; startMediaRecorder()', off),
        emit: (b) => off.recorder.ondataavailable({ data: new NodeBlob([b]) }),
        buffered: () => vm.runInContext('streamBufferedBytes', off),
    };
}

async function recordWithLateBegin(server) {
    const ext = v209Extension(server);
    const slices = timeslices(400);
    await ext.startRecorder();
    const opening = ext.worker.start();       // background.js: void startStreamingUpload()
    ext.emit(slices[0]);                      // the first timeslice lands first
    server.answerBegin();
    await opening;
    for (const b of slices.slice(1)) { ext.emit(b); await settle(); }
    while (ext.worker.state()?.busy || ext.buffered() >= PART) await settle();
    return { ext, slices };
}

describe.skipIf(!haveV209)('known issue: extension v2.0.9 loses what it records before begin answers', () => {
    it('with the server refusing a headerless webm (422), it aborts and registers nothing', async () => {
        const server = api({ headerCheck: true });
        const { ext } = await recordWithLateBegin(server);
        const streamed = await ext.worker.stopAndRegister('rec-1');

        expect(streamed).toBeNull();
        expect(server.calls).toContain('/recordings/upload/abort');
        expect(server.calls).not.toContain('/recordings');
        expect(server.completed).toBe(false);
    });

    it('a complete recording still registers with the check on', async () => {
        const server = api({ headerCheck: true });
        server.answerBegin();
        const ext = v209Extension(server);
        const slices = timeslices(100);
        await ext.startRecorder();
        await ext.worker.start();
        for (const b of slices) { ext.emit(b); await settle(); }
        while (ext.worker.state()?.busy || ext.buffered() >= PART) await settle();
        const streamed = await ext.worker.stopAndRegister('rec-2');

        expect(streamed?.fileUrl).toBeTruthy();
        expect(server.calls).toContain('/recordings');
        expect(server.object.equals(Buffer.concat(slices))).toBe(true);
    });

    it('the stored file starts mid-stream, yet the upload completes', async () => {
        const server = api();
        const ext = v209Extension(server);
        const slices = timeslices(400);
        await ext.startRecorder();
        const opening = ext.worker.start();       // background.js: void startStreamingUpload()
        ext.emit(slices[0]);                      // the first timeslice lands first
        server.answerBegin();
        await opening;
        for (const b of slices.slice(1)) { ext.emit(b); await settle(); }
        while (ext.worker.state()?.busy || ext.buffered() >= PART) await settle();
        const done = await ext.worker.finish();

        expect(done?.fileUrl).toBeTruthy();       // so v2.0.9 registers it: "link ready"
        expect(server.object.subarray(0, 4).toString('hex')).not.toBe(EBML);
        expect(server.object.equals(Buffer.concat(slices.slice(1)))).toBe(true);
    });
});
