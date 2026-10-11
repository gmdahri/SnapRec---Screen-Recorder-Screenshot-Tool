// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

/** Finishing the upload after Stop, now that the share tab no longer waits
 * for it.
 *
 * The page has the recording and shows this upload's progress, so a slow
 * upload is allowed to finish. What ends it:
 *  - a stall: no bytes moving for 60 s (the request under way is cancelled);
 *  - a cap on failed attempts across the whole drain, so a connection that
 *    fails fast cannot keep it open on retries.
 * And the final drain no longer queues behind a regular drain that has no
 * limits at all, which is how a backlog at Stop used to run past every cap.
 *
 * Timers are faked; `now` is the faked clock. */

const PART = 5 * 1024 * 1024;
const STALL = 60_000;

function load() {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Blob, AbortSignal, AbortController, Promise, Error, JSON, Math, Number, String, Array, Object,
        crypto: webcrypto, setTimeout, clearTimeout,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../background/stream-upload.js'), 'utf8'), sandbox);
    return sandbox.SnapRecStreamUpload;
}

const memoryStore = () => ({ list: async () => [], write: async () => {}, remove: async () => {} });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status });

/** The API answers at once; R2 parts go through `put`, which each test scripts. */
function rig({ put }) {
    const s = { completed: null, aborted: false, events: [], progress: [], puts: [] };
    const fetch = async (url, init = {}) => {
        const path = String(url).replace('https://api.test', '');
        const body = init.body ? JSON.parse(init.body) : {};
        if (path === '/recordings/upload/begin') return json({ uploadId: 'up-1' });
        if (path === '/recordings/upload/part') return json({ uploadUrl: `https://r2.test/${body.partNumber}` });
        if (path === '/recordings/upload/complete') { s.completed = body.parts.map((p) => p.PartNumber); return json({ fileUrl: body.fileName }); }
        if (path === '/recordings/upload/abort') { s.aborted = true; return json({}); }
        return json({}, 404);
    };
    const up = load().createStreamUploader({
        apiBase: 'https://api.test', fetch, store: memoryStore(),
        track: (event, props) => s.events.push({ event, ...props }),
        partSliceLength: (b, f) => (b <= 0 ? 0 : f ? b : b >= PART ? PART : 0),
        partMinBytes: PART,
        now: () => Date.now(), setTimer: setTimeout, clearTimer: clearTimeout,
        putPart: async (url, blob, opts) => {
            const n = Number(url.split('/').pop());
            s.puts.push(n);
            return put(n, blob, opts);
        },
        onProgress: (p) => s.progress.push(p),
    });
    return { up, s };
}

const ok = (n) => ({ ok: true, status: 200, etag: `"e${n}"` });
const after = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms));
const chunk = (bytes) => new Blob([new Uint8Array(bytes)]);
const failed = (s) => s.events.find((e) => e.event === 'upload_failed');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

async function withBacklog(up, parts, tail = 1024) {
    await up.begin();
    for (let i = 0; i < parts; i++) up.push(chunk(PART));
    up.push(chunk(tail));
}

describe('a slow upload that keeps moving', () => {
    it('is finished however long it takes, including a backlog the regular drain was working through at Stop', async () => {
        // 30 parts at 10 s each: five minutes. Each one moves bytes.
        const { up, s } = rig({ put: (n) => after(10_000, ok(n)) });
        await withBacklog(up, 30);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(400_000);
        expect(await result).toMatchObject({ fileUrl: expect.any(String) });
        // Every 5 MB part plus the short tail, in order, each its own request.
        expect(s.completed).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
        expect(s.aborted).toBe(false);
    });

    it('a single part slower than the stall limit survives while it reports bytes leaving', async () => {
        // One part takes 100 s, reporting progress every 10 s.
        const { up, s } = rig({
            put: async (n, blob, { onProgress }) => {
                for (let t = 1; t <= 10; t++) { await after(10_000); onProgress?.((blob.size * t) / 10); }
                return ok(n);
            },
        });
        await withBacklog(up, 1);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(await result).toMatchObject({ fileUrl: expect.any(String) });
        expect(failed(s)).toBeUndefined();
    });
});

describe('a stall', () => {
    it('ends the drain after 60 s of no bytes, cancels the hung request, and aborts the upload', async () => {
        let cancelled = false;
        const { up, s } = rig({
            put: (n, blob, { signal }) => new Promise((_, reject) => {
                signal?.addEventListener('abort', () => { cancelled = true; reject(new Error('aborted')); });
            }),
        });
        await withBacklog(up, 2);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(STALL - 2_000);
        expect(s.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(4_000);
        expect(await result).toBeNull();
        expect(cancelled).toBe(true);
        expect(s.aborted).toBe(true);
        expect(failed(s)).toMatchObject({ error_reason: 'stalled' });
        expect(s.progress.at(-1)).toMatchObject({ state: 'failed', reason: 'stalled' });
    });
});

describe('a connection that fails fast', () => {
    it('gives up after its retries instead of holding the upload open', async () => {
        const { up, s } = rig({ put: async () => { throw new TypeError('Failed to fetch'); } });
        await withBacklog(up, 3);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(STALL);
        expect(await result).toBeNull();
        expect(s.aborted).toBe(true);
        expect(s.puts.length).toBeLessThanOrEqual(10);
        expect(failed(s).error_reason).toMatch(/part_failed|retries_exhausted/);
    });

    it('caps failed attempts across the whole drain, not just per part', async () => {
        // Every part fails three times, then goes up: under the per-part
        // limit, but twelve parts of it is a connection that is not working.
        const tries = new Map();
        const { up, s } = rig({
            put: async (n) => {
                const t = (tries.get(n) ?? 0) + 1; tries.set(n, t);
                if (t <= 3) throw new TypeError('Failed to fetch');
                return ok(n);
            },
        });
        await withBacklog(up, 12);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(600_000);
        expect(await result).toBeNull();
        expect(failed(s)).toMatchObject({ error_reason: 'retries_exhausted' });
        expect(s.puts.length).toBeLessThan(12 * 4);
    });
});

describe('the final part', () => {
    it('is retried after a failure and the upload completes', async () => {
        let first = true;
        const { up, s } = rig({
            put: async (n) => {
                if (n === 2 && first) { first = false; throw new TypeError('Failed to fetch'); }
                return ok(n);
            },
        });
        await withBacklog(up, 1);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await result).toMatchObject({ fileUrl: expect.any(String) });
        expect(s.completed).toEqual([1, 2]);
    });
});

describe('progress', () => {
    it('reports uploading with growing bytes against a fixed total, then completing, then done', async () => {
        const { up, s } = rig({ put: (n) => after(1_000, ok(n)) });
        await withBacklog(up, 3, 2048);
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(30_000);
        await result;
        const states = [...new Set(s.progress.map((p) => p.state))];
        expect(states).toEqual(['uploading', 'completing', 'done']);
        const total = 3 * PART + 2048;
        expect(new Set(s.progress.map((p) => p.totalBytes))).toEqual(new Set([total]));
        const bytes = s.progress.map((p) => p.uploadedBytes);
        expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
        expect(bytes.at(-1)).toBe(total);
    });

    it('says nothing while recording: progress belongs to the time after Stop', async () => {
        const { up, s } = rig({ put: (n) => after(10, ok(n)) });
        await up.begin();
        up.push(chunk(PART * 2));
        await vi.advanceTimersByTimeAsync(1_000);
        expect(s.progress).toEqual([]);
    });
});

/** At Stop the recorder hands over a patched header (same length as part 1's
 * start) and an index to append (background/webm-cues.js). The upload must
 * end up byte-for-byte what the local copy is. */
describe('the duration and seek index', () => {
    const HEADER = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 9, 9, 9, 9]);   // stands for the patched header
    const TRAILER = new Uint8Array([0x1c, 0x53, 0xbb, 0x6b, 7, 7]);

    /** An R2 that keeps the bytes of each part, so the assembled file can be read. */
    function storingRig(opts = {}) {
        const bodies = new Map();
        const puts = [];
        const r = rig({
            put: async (n, blob) => {
                puts.push(n);
                if (opts.failReupload && n === 1 && bodies.has(1)) throw new TypeError('Failed to fetch');
                bodies.set(n, Buffer.from(await blob.arrayBuffer()));
                return { ok: true, status: 200, etag: `"e${n}-${puts.length}"` };
            },
        });
        r.assembled = () => Buffer.concat(r.s.completed.map((n) => bodies.get(n)));
        r.puts = puts;
        return r;
    }
    const startsWith = (buf, bytes) => Buffer.from(bytes).equals(buf.subarray(0, bytes.length));
    const endsWith = (buf, bytes) => Buffer.from(bytes).equals(buf.subarray(buf.length - bytes.length));

    it('part 1 already uploaded: it is sent again with the patched header, once, and the index goes at the end', async () => {
        const { up, s, assembled, puts } = storingRig();
        await up.begin();
        up.push(new Blob([new Uint8Array(PART).fill(1)]));      // part 1, uploaded while recording
        await vi.advanceTimersByTimeAsync(100);
        up.push(new Blob([new Uint8Array(1000).fill(2)]));
        const result = up.finish({ header: HEADER, trailer: TRAILER });
        await vi.advanceTimersByTimeAsync(30_000);
        expect(await result).toMatchObject({ fileUrl: expect.any(String) });
        const file = assembled();
        expect(startsWith(file, HEADER)).toBe(true);
        expect(endsWith(file, TRAILER)).toBe(true);
        expect(file.length).toBe(PART + 1000 + TRAILER.length);
        expect(puts.filter((n) => n === 1)).toHaveLength(2);
        expect(s.completed).toEqual([1, 2]);
    });

    it('part 1 not yet uploaded (a short recording): patched in place, nothing sent twice', async () => {
        const { up, assembled, puts } = storingRig();
        await up.begin();
        up.push(new Blob([new Uint8Array(3000).fill(1)]));
        const result = up.finish({ header: HEADER, trailer: TRAILER });
        await vi.advanceTimersByTimeAsync(30_000);
        await result;
        const file = assembled();
        expect(startsWith(file, HEADER)).toBe(true);
        expect(endsWith(file, TRAILER)).toBe(true);
        expect(file.length).toBe(3000 + TRAILER.length);
        expect(puts).toEqual([1]);
    });

    it('part 1 still in flight at Stop: once it lands it is sent again patched', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const bodies = new Map(); const puts = [];
        const r = rig({
            put: async (n, blob) => {
                puts.push(n);
                if (n === 1 && puts.length === 1) await gate;
                bodies.set(n, Buffer.from(await blob.arrayBuffer()));
                return { ok: true, status: 200, etag: `"e${n}-${puts.length}"` };
            },
        });
        await r.up.begin();
        r.up.push(new Blob([new Uint8Array(PART).fill(1)]));
        await vi.advanceTimersByTimeAsync(10);
        const result = r.up.finish({ header: HEADER, trailer: TRAILER });
        release();
        await vi.advanceTimersByTimeAsync(30_000);
        await result;
        const file = Buffer.concat(r.s.completed.map((n) => bodies.get(n)));
        expect(startsWith(file, HEADER)).toBe(true);
        expect(endsWith(file, TRAILER)).toBe(true);
    });

    it('if sending part 1 again keeps failing, the recording is completed without the index rather than lost', async () => {
        const { up, s, assembled } = storingRig({ failReupload: true });
        await up.begin();
        up.push(new Blob([new Uint8Array(PART).fill(1)]));
        await vi.advanceTimersByTimeAsync(100);
        up.push(new Blob([new Uint8Array(1000).fill(2)]));
        const result = up.finish({ header: HEADER, trailer: TRAILER });
        await vi.advanceTimersByTimeAsync(120_000);
        expect(await result).toMatchObject({ fileUrl: expect.any(String) });
        expect(s.aborted).toBe(false);
        expect(assembled()[0]).toBe(1);                         // the original part 1
        expect(s.events.some((e) => e.event === 'upload_index_skipped')).toBe(true);
    });

    it('without an index the upload is exactly as before', async () => {
        const { up, assembled, puts } = storingRig();
        await up.begin();
        up.push(new Blob([new Uint8Array(PART).fill(1)]));
        await vi.advanceTimersByTimeAsync(100);
        up.push(new Blob([new Uint8Array(1000).fill(2)]));
        const result = up.finish();
        await vi.advanceTimersByTimeAsync(30_000);
        await result;
        expect(assembled().length).toBe(PART + 1000);
        expect(puts).toEqual([1, 2]);
    });
});
