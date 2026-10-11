import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

/** The failure paths of background/stream-upload.js that a whole recording
 * does not reach: lost or duplicated registrations during recovery, a store
 * that hangs, a network that is gone for longer than one retry. */

const MB = 1024 * 1024;
const PART = 5 * MB;
// Timers run 1000x fast, so a 5-second store timeout costs 5 ms.
const fast = (fn, ms) => setTimeout(fn, ms / 1000);

function load() {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Blob, AbortSignal, AbortController, Promise, Error, JSON, Math, Number, String, Array, Object,
        crypto: webcrypto,
        setTimeout, clearTimeout,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(resolve(__dirname, '../background/stream-upload.js'), 'utf8'), sandbox);
    return sandbox.SnapRecStreamUpload;
}

function memoryStore() {
    const map = new Map();
    return {
        map,
        list: async () => [...map.values()].map((r) => structuredClone(r)),
        write: async (r) => { map.set(r.uploadId, structuredClone(r)); },
        remove: async (id) => { map.delete(id); },
    };
}

/** API + R2 with switches. complete on an upload that is not open answers 500,
 * as the real controller does for R2's NoSuchUpload. */
function server() {
    const s = { calls: [], uploads: new Map(), offline: false, failComplete: 0, failPut: 0, registered: [] };
    s.fetch = async (url, init = {}) => {
        const path = String(url).replace('https://api.test', '');
        s.calls.push(path);
        if (s.offline) throw new TypeError('Failed to fetch');
        const json = (o, status = 200) => new Response(JSON.stringify(o), { status });
        const body = init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
        if (path.startsWith('https://r2.test/')) {
            if (s.failPut > 0) { s.failPut--; return new Response('', { status: 503 }); }
            return new Response('', { status: 200, headers: { ETag: `"e${s.calls.length}"` } });
        }
        if (path === '/recordings/upload/begin') {
            const uploadId = `up-${s.uploads.size + 1}`;
            s.uploads.set(uploadId, { fileName: body.fileName, state: 'open' });
            return json({ uploadId });
        }
        if (path === '/recordings/upload/part') return json({ uploadUrl: `https://r2.test/${body.uploadId}/${body.partNumber}` });
        if (path === '/recordings/upload/complete') {
            const up = s.uploads.get(body.uploadId);
            if (s.failComplete > 0) { s.failComplete--; return json({}, 503); }
            if (!up || up.state !== 'open') return json({}, 500);
            up.state = 'complete';
            return json({ fileUrl: up.fileName });
        }
        if (path === '/recordings/upload/abort') { const up = s.uploads.get(body.uploadId); if (up) up.state = 'aborted'; return json({}); }
        if (path.startsWith('/recordings/status/')) {
            const name = decodeURIComponent(path.slice('/recordings/status/'.length));
            return json({ ready: [...s.uploads.values()].some((u) => u.fileName === name && u.state === 'complete') });
        }
        return json({}, 404);
    };
    return s;
}

function uploader({ api = server(), store = memoryStore(), now, setTimer = fast } = {}) {
    const lib = load();
    const events = [];
    const up = lib.createStreamUploader({
        apiBase: 'https://api.test', fetch: api.fetch, store,
        track: (event, props) => events.push({ event, ...props }),
        partSliceLength: (buffered, isFinal) => (buffered <= 0 ? 0 : isFinal ? buffered : buffered >= PART ? PART : 0),
        partMinBytes: PART,
        setTimer,
        ...(now ? { now } : {}),
    });
    return { up, api, store, events, lib };
}

function recover({ lib = load(), api, store, now, registration = 'created', ...opts }) {
    const events = []; const registered = [];
    // Absent means "no upload in progress"; an explicit undefined means "could not ask".
    const liveUploadId = 'liveUploadId' in opts ? opts.liveUploadId : null;
    return lib.recoverInterruptedUploads({
        store, apiBase: 'https://api.test', fetch: api.fetch, liveUploadId,
        register: async (id, fileUrl) => { registered.push({ id, fileUrl }); return registration; },
        track: (event, props) => events.push({ event, ...props }),
        ...(now ? { now } : {}),
    }).then((outcomes) => ({ outcomes, events, registered }));
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const chunk = (n) => new Blob([new Uint8Array(n)]);

/** A record as an interrupted recording leaves it: two parts on R2. */
async function orphan(api, store, extra = {}) {
    const { up } = uploader({ api, store });
    await up.begin();
    up.push(chunk(11 * MB));
    await tick();
    const [rec] = await store.list();
    Object.assign(rec, extra);
    await store.write(rec);
    return rec;
}

describe('recovery never loses or duplicates a recording', () => {
    it('leaves the live upload alone and finalizes only the orphan beside it', async () => {
        const api = server(); const store = memoryStore();
        const stale = await orphan(api, store);
        const { up } = uploader({ api, store });
        await up.begin();                                  // a new recording, still running
        const live = up.status().uploadId;

        const { outcomes, registered } = await recover({ api, store, liveUploadId: live });

        expect(outcomes.sort()).toEqual(['finalized', 'live']);
        expect(registered.map((r) => r.fileUrl)).toEqual([stale.fileName]);
        expect(store.map.has(live)).toBe(true);           // the live record survived
        expect(api.uploads.get(live).state).toBe('open');
    });

    it('does nothing at all when the offscreen document cannot be asked', async () => {
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const { outcomes, registered } = await recover({ api, store, liveUploadId: undefined });
        expect(outcomes).toEqual(['unknown']);
        expect(registered).toEqual([]);
        expect(api.calls.filter((c) => c.includes('complete'))).toEqual([]);
    });

    it('registers an upload an earlier recovery completed but died before recording', async () => {
        const api = server(); const store = memoryStore();
        const rec = await orphan(api, store, { completing: true, recoveryId: 'rec-fixed' });
        api.uploads.get(rec.uploadId).state = 'complete'; // completed; the worker died before saying so

        const { outcomes, registered } = await recover({ api, store });
        expect(outcomes).toEqual(['finalized']);
        expect(registered).toEqual([{ id: 'rec-fixed', fileUrl: rec.fileName }]);
    });

    it('does not register a completed upload it did not complete itself', async () => {
        // Stop forgets its record before completing; a leftover one means that
        // removal failed, and the normal path already registered the recording.
        const api = server(); const store = memoryStore();
        const rec = await orphan(api, store);
        api.uploads.get(rec.uploadId).state = 'complete';

        const { outcomes, registered } = await recover({ api, store });
        expect(outcomes).toEqual(['retry']);
        expect(registered).toEqual([]);
    });

    it('reuses its id when a registration is retried, so a retry is the same row', async () => {
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const lib = load();
        const ids = [];
        const attempt = (ok) => lib.recoverInterruptedUploads({
            store, apiBase: 'https://api.test', fetch: api.fetch, liveUploadId: null,
            register: async (id) => { ids.push(id); return ok ? 'created' : 'failed'; }, track: () => {},
        });
        expect(await attempt(false)).toEqual(['retry']);
        expect(await attempt(true)).toEqual(['finalized']);
        expect(new Set(ids).size).toBe(1);
        expect(store.map.size).toBe(0);
    });

    it('takes a 200 — the server handing back the row an earlier attempt made — as done', async () => {
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const { outcomes, events } = await recover({ api, store, registration: 'exists' });
        expect(outcomes).toEqual(['finalized']);
        expect(store.map.size).toBe(0);
        expect(events.at(-1)).toMatchObject({ event: 'upload_completed', recovered: true, registration: 'exists' });
    });

    it('takes a 409 as already registered, and does not register a second row under a new id', async () => {
        // The id is recovery's own; a 409 means an earlier attempt registered
        // it and the user has since claimed it, so the guest can no longer post to it.
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const { outcomes, registered, events } = await recover({ api, store, registration: 'conflict' });
        expect(outcomes).toEqual(['finalized']);
        expect(registered).toHaveLength(1);
        expect(store.map.size).toBe(0);
        expect(events.at(-1)).toMatchObject({ event: 'upload_completed', registration: 'conflict' });
    });

    it('registered, killed before cleaning up, claimed meanwhile: the next start ends it with no duplicate', async () => {
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const lib = load();
        // The server, insert-only: the first POST creates; after the claim the
        // guest's retry of the same id is refused.
        const rows = new Map();
        const register = async (id) => {
            if (!rows.has(id)) { rows.set(id, { owner: 'guest' }); return 'created'; }
            return rows.get(id).owner === 'guest' ? 'exists' : 'conflict';
        };
        const removeOnce = store.remove;
        let killed = true;
        store.remove = async (id) => { if (killed) { killed = false; throw new Error('worker killed'); } return removeOnce(id); };
        const run = () => lib.recoverInterruptedUploads({
            store, apiBase: 'https://api.test', fetch: api.fetch, liveUploadId: null, register, track: () => {},
        });

        expect(await run()).toEqual(['finalized']);   // registered; the cleanup "died"
        expect(store.map.size).toBe(1);
        [...rows.values()][0].owner = 'sb-user';      // the user signs in and claims it
        expect(await run()).toEqual(['finalized']);   // 409 -> already registered
        expect(rows.size).toBe(1);
        expect(store.map.size).toBe(0);
    });

    it('an expired session keeps the upload for a later start, and never registers it as a guest', async () => {
        const api = server(); const store = memoryStore();
        await orphan(api, store);
        const { outcomes, registered, events } = await recover({ api, store, registration: 'unauthorized' });
        expect(outcomes).toEqual(['retry']);
        expect(registered).toHaveLength(1);                 // the one signed-in attempt, nothing after it
        expect(store.map.size).toBe(1);
        expect(events.at(-1)).toMatchObject({ event: 'upload_failed', error_reason: 'recovery_session_expired' });
    });

    it('gives up on an upload R2 has already swept, instead of retrying forever', async () => {
        const api = server(); const store = memoryStore();
        const rec = await orphan(api, store);
        api.uploads.get(rec.uploadId).state = 'aborted'; // the 1-day rule ran
        const later = () => rec.startedAt + 27 * 60 * 60 * 1000;

        const { outcomes, events } = await recover({ api, store, now: later });
        expect(outcomes).toEqual(['gone']);
        expect(store.map.size).toBe(0);
        expect(events).toEqual([expect.objectContaining({ error_reason: 'recovery_upload_gone' })]);
    });

    it('discards a record it cannot make sense of', async () => {
        const api = server(); const store = memoryStore();
        await store.write({ uploadId: 'junk', parts: 'not-an-array' });
        const { outcomes } = await recover({ api, store });
        expect(outcomes).toEqual(['invalid']);
        expect(store.map.size).toBe(0);
    });

    it('a new recording does not overwrite an orphan still waiting for recovery', async () => {
        const api = server(); const store = memoryStore();
        const stale = await orphan(api, store);
        const { up } = uploader({ api, store });
        await up.begin();
        expect(store.map.has(stale.uploadId)).toBe(true);
        expect(store.map.size).toBe(2);
    });
});

describe('stop', () => {
    it('forgets the record before completing, so recovery can never register it again', async () => {
        const api = server(); const store = memoryStore();
        const { up } = uploader({ api, store });
        await up.begin();
        up.push(chunk(7 * MB));
        expect(await up.finish()).toMatchObject({ fileUrl: expect.stringMatching(/^video-/) });
        expect(store.map.size).toBe(0);
    });

    it('aborts when completion keeps failing — the share page has the local copy', async () => {
        const api = server(); const store = memoryStore();
        const { up, events } = uploader({ api, store });
        await up.begin();
        up.push(chunk(7 * MB));
        api.failComplete = 99;
        expect(await up.finish()).toBeNull();
        const [upload] = api.uploads.values();
        expect(upload.state).toBe('aborted');
        expect(store.map.size).toBe(0);                    // nothing left for recovery to duplicate
        expect(events.at(-1)).toMatchObject({ event: 'upload_failed', error_reason: 'complete_failed' });
    });

    it('retries a transient completion failure', async () => {
        const api = server();
        const { up } = uploader({ api });
        await up.begin();
        up.push(chunk(7 * MB));
        api.failComplete = 2;
        expect(await up.finish()).not.toBeNull();
    });
});

describe('the network and the store failing', () => {
    it('does not retry on every chunk while a failed part waits out its backoff', async () => {
        const api = server();
        // Backoff timers that never fire: only push() could cause another attempt.
        const { up } = uploader({ api, setTimer: (fn, ms) => (ms >= 1000 ? { never: true } : setTimeout(fn, ms / 1000)) });
        await up.begin();
        api.offline = true;
        up.push(chunk(6 * MB));                            // first attempt fails, a retry is scheduled
        await tick();
        const before = api.calls.length;
        for (let i = 0; i < 20; i++) up.push(chunk(MB));   // twenty more seconds of recording
        await tick();
        expect(api.calls.length).toBe(before);
    });

    it('reports a few failures of an offline streak, not one per retry', async () => {
        const api = server();
        const { up, events } = uploader({ api });
        await up.begin();
        api.offline = true;
        up.push(chunk(6 * MB));
        await tick(300);                                   // many backoff cycles at 1000x
        expect(api.calls.filter((c) => c === '/recordings/upload/part').length).toBeGreaterThan(5);
        expect(events.filter((e) => e.event === 'upload_part_failed')).toHaveLength(3);
        await up.abort('test');
    });

    it('keeps uploading when progress cannot be saved', async () => {
        const api = server();
        const store = { ...memoryStore(), write: async () => { throw new Error('QuotaExceededError'); } };
        const { up, events } = uploader({ api, store });
        await up.begin();
        up.push(chunk(7 * MB));
        expect(await up.finish()).not.toBeNull();
        expect(events.at(-1)).toMatchObject({ event: 'upload_completed', progress_save_failures: expect.any(Number) });
        expect(events.at(-1).progress_save_failures).toBeGreaterThan(0);
    });

    it('is not stalled by a store that never answers', async () => {
        const api = server();
        const store = { ...memoryStore(), write: () => new Promise(() => {}), remove: () => new Promise(() => {}) };
        const { up } = uploader({ api, store });
        await up.begin();
        up.push(chunk(7 * MB));
        const result = await Promise.race([up.finish(), tick(2000).then(() => 'stalled')]);
        expect(result).not.toBe('stalled');
        expect(result).not.toBeNull();
    });
});
