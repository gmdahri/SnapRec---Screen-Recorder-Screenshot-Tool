import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** The service worker is not a place to keep a recording's state.
 *
 * Chrome terminates an MV3 worker after 30 seconds without an event. During a
 * recording the only events it gets are a content script's mouse and scroll
 * batches and, every 5 MB of video, a part-ready ping — so a low-motion
 * recording (slides, a document, a call) goes quiet long enough to lose the
 * worker within its first minute. This was confirmed in a real browser: the
 * worker died 30 s in and came back with streamingUpload === null.
 *
 * These tests run the real background.js and the real offscreen document in
 * separate sandboxes and throw the worker away mid-recording, as Chrome does. */

const MB = 1024 * 1024;
let h;
afterEach(() => h?.dispose());

async function startRecording() {
    h = createHarness();
    await h.sw('startRecording({ microphone: false, systemAudio: false })');
    await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder to start' });
    await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'upload to open' });
    await h.settle();
}

/** One MediaRecorder timeslice per call, with the event loop turning between
 * them as it does between real one-second chunks. */
async function record(totalMB, chunkMB = 1) {
    for (let sent = 0; sent < totalMB; sent += chunkMB) {
        h.recorder().emit(chunkMB * MB);
        await h.settle(15);
    }
    await h.settle();
}

/** The share tab opens whether or not the upload made it, so waiting for it
 * lets a lost upload fail as an assertion rather than as a timeout. */
async function stopFromPage() {
    await h.fromContent({ action: 'stopRecording' }).catch(() => {});
    await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
    await h.settle(150);
}

function theUpload() {
    const [up] = h.net.uploads.values();
    return { state: up.state, bytes: up.bytes ?? 0, fileName: up.fileName };
}

const registered = () => h.apiCalls('/recordings').map((c) => c.body.fileUrl);

const eventNamed = (name) => h.events().filter((e) => e.event === name).map((e) => e.properties);

/** Reads the extension origin's IndexedDB as handoff.js and the worker do. */
function readParked(key) {
    return new Promise((resolvePromise, reject) => {
        const request = h.shared.idb.open('SnapRecDB', 2);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore('recordings');
        request.onsuccess = (e) => {
            const get = e.target.result.transaction(['recordings']).objectStore('recordings').get(key);
            get.onsuccess = () => resolvePromise(get.result);
            get.onerror = () => reject(get.error);
        };
        request.onerror = () => reject(request.error);
    });
}

describe('a recording survives the service worker being terminated', () => {
    it('control: with the worker alive throughout, every byte is uploaded and the recording registered', async () => {
        await startRecording();
        await record(23);
        await stopFromPage();

        expect(theUpload().state).toBe('complete');
        expect(theUpload().bytes).toBe(23 * MB);
        expect(registered()).toEqual([theUpload().fileName]);
    });

    it('worker terminated mid-recording: the upload still completes with every byte', async () => {
        await startRecording();
        await record(7);            // one part's worth goes up while the first worker is alive
        h.terminateWorker();        // 30 s of quiet
        await record(16);           // the recording carries on; the next event boots a fresh worker
        await stopFromPage();

        expect(theUpload().state).toBe('complete');
        expect(theUpload().bytes).toBe(23 * MB);
        expect(registered()).toEqual([theUpload().fileName]);
        // The restarted worker found the upload live and left it to its owner.
        expect(h.apiCalls('/recordings/upload/complete')).toHaveLength(1);
        expect(eventNamed('upload_completed').map((e) => e.recovered)).toEqual([false]);
    });

    it('keeps the click trail recorded before the worker was terminated', async () => {
        await startRecording();
        await h.fromContent({ action: 'recordMetadataChunks', chunks: [{ type: 'click', t: 1 }] });
        await record(2);
        h.terminateWorker();
        await h.fromContent({ action: 'recordMetadataChunks', chunks: [{ type: 'click', t: 2 }] });
        await record(2);
        await stopFromPage();

        expect(JSON.parse(await readParked('latest_metadata'))).toEqual([
            { type: 'click', t: 1 }, { type: 'click', t: 2 },
        ]);
    });
});

describe('recovery when the recording itself is interrupted', () => {
    it('finalizes from the parts on R2 when the offscreen document died mid-recording', async () => {
        await startRecording();
        await record(12);            // parts 1 and 2 are on R2; 2 MB was only in memory
        h.killOffscreen();           // renderer crash, or the browser quitting
        h.terminateWorker();
        h.bootWorker();              // the next start, whatever wakes it

        await h.waitFor(() => registered().length === 1, { what: 'the recovered recording to be registered' });
        await h.waitFor(() => eventNamed('upload_completed').length === 1, { what: 'upload_completed' });
        expect(theUpload().state).toBe('complete');
        expect(theUpload().bytes).toBe(10 * MB);
        expect(registered()).toEqual([theUpload().fileName]);
        expect(eventNamed('upload_completed')).toEqual([
            expect.objectContaining({ recovered: true, parts: 2 }),
        ]);
        // The popup and in-page bar must not keep showing a recording that is gone.
        expect(h.shared.local.get('isRecording')).toBe(false);
        expect(await readParked('upload:up-1')).toBeUndefined();
    });

    it('aborts when nothing had reached R2 yet', async () => {
        await startRecording();
        await record(2);
        h.killOffscreen();
        h.terminateWorker();
        h.bootWorker();

        await h.waitFor(() => theUpload().state === 'aborted', { what: 'the upload to be aborted' });
        expect(registered()).toEqual([]);
        expect(eventNamed('upload_failed')).toEqual([
            expect.objectContaining({ error_reason: 'interrupted_before_first_part', recovered: true }),
        ]);
    });

    it('keeps the record and finishes on a later start when the network was down', async () => {
        await startRecording();
        await record(12);
        h.killOffscreen();
        h.terminateWorker();
        h.net.offline = true;
        h.bootWorker();
        await h.settle(150);
        expect(theUpload().state).toBe('open');
        expect(await readParked('upload:up-1')).toMatchObject({ uploadId: 'up-1' });

        h.terminateWorker();
        h.net.offline = false;
        h.bootWorker();
        await h.waitFor(() => registered().length === 1, { what: 'the retried recovery' });
        expect(theUpload().bytes).toBe(10 * MB);
    });
});

describe('the upload itself', () => {
    it('reports upload_started and upload_completed', async () => {
        await startRecording();
        await record(6);
        await stopFromPage();

        expect(eventNamed('upload_started')).toHaveLength(1);
        expect(eventNamed('upload_completed')).toEqual([
            expect.objectContaining({ parts: 2, file_size_mb: 6, recovered: false }),
        ]);
    });

    it('retries a failed part and reports upload_part_failed, losing nothing', async () => {
        await startRecording();
        h.net.failNext['r2.test/'] = 1;
        await record(12);
        await stopFromPage();

        expect(eventNamed('upload_part_failed')).toEqual([
            expect.objectContaining({ part_number: 1, attempt: 1 }),
        ]);
        expect(theUpload().state).toBe('complete');
        expect(theUpload().bytes).toBe(12 * MB);
    });

    it('drains the bytes buffered behind a failed part when the recording stops', async () => {
        await startRecording();
        await record(7);
        h.net.failNext['r2.test/'] = 1;
        h.recorder().emit(11 * MB);  // part 2 fails with 13 MB buffered, then stop at once
        await stopFromPage();

        expect(theUpload().state).toBe('complete');
        expect(theUpload().bytes).toBe(18 * MB);
    });

    it('aborts rather than publish a recording with its end missing', async () => {
        await startRecording();
        await record(7);
        h.net.failNext['r2.test/'] = 99;
        await record(4);
        await stopFromPage();

        expect(theUpload().state).toBe('aborted');
        expect(h.apiCalls('/recordings/upload/complete')).toHaveLength(0);
        expect(registered()).toEqual([]);
        expect(eventNamed('upload_failed')).toEqual([
            expect.objectContaining({ error_reason: 'part_failed' }),
        ]);
        // The capture itself still reaches the share page.
        expect(h.tabs.some((t) => t.url.includes('/v'))).toBe(true);
    });

    it('a part upload that never answers does not hold Stop hostage', async () => {
        await startRecording();
        await record(7);
        h.net.hang = 'r2.test/';     // the connection black-holes mid-recording
        await record(6);
        await stopFromPage();        // the share tab still opens

        expect(theUpload().state).toBe('aborted');
        expect(registered()).toEqual([]);
        expect(await readParked('latest_video_blob')).toBeDefined();
    }, 15000);

    it('reports upload_failed when the upload cannot open, and the recording still finishes', async () => {
        h = createHarness();
        h.net.failNext['/upload/begin'] = 1;
        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder to start' });
        await h.settle();
        await record(6);
        await stopFromPage();

        expect(eventNamed('upload_failed')).toEqual([
            expect.objectContaining({ error_reason: 'begin_failed' }),
        ]);
        expect(registered()).toEqual([]);
        expect(await readParked('latest_video_blob')).toBeDefined();
    });
});
