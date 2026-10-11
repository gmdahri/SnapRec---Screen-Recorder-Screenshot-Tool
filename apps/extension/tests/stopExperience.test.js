import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** Stop opens the share tab at once, whatever the network is doing.
 *
 * It used to drain the last parts, complete the upload and register the row
 * first: seconds normally, and up to the worker's 200 s cap with an uplink
 * slower than the recording — after which the upload was aborted. Now the tab
 * opens before any network work; the offscreen document hands the recording
 * over a BroadcastChannel (the test plays the courier frame), finishes the
 * upload in the background, has the worker register it, and the document is
 * closed only once all of that is settled.
 *
 * The real background.js and offscreen document, in the harness. */

const MB = 1024 * 1024;
let h;
afterEach(() => h?.dispose());

async function start(opts) {
    h = createHarness(opts);
    await h.sw('startRecording({ microphone: false, systemAudio: false })');
    await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder to start' });
    await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'upload to open' });
    await h.settle();
}

async function record(totalMB, chunkMB = 1) {
    for (let sent = 0; sent < totalMB; sent += chunkMB) {
        h.recorder().emit(chunkMB * MB);
        await h.settle(15);
    }
    await h.settle();
}

/** Stops, and returns what the network had seen when the share tab opened. */
async function stop() {
    void h.fromContent({ action: 'stopRecording' }).catch(() => {});
    await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
    const shareTab = h.tabs.find((t) => t.url.includes('/v'));
    const before = h.net.calls.map((c) => c.url.replace(h.API, ''));
    return { shareTab, before, id: new URL(shareTab.url).searchParams.get('r') };
}

const theUpload = () => [...h.net.uploads.values()].at(-1);
const registrations = () => h.apiCalls('/recordings');
const progress = () => h.channelLog.filter((m) => m.data.type === 'progress').map((m) => m.data);
const lastState = () => progress().at(-1)?.state;

/** The courier frame's side: asks for the recording by id, acknowledges it. */
async function takeDelivery(id, { acknowledge = true } = {}) {
    const courier = h.channel('snaprec-handoff');
    courier.postMessage({ type: 'want', id });
    await h.waitFor(() => courier.received.some((m) => m.type === 'recording'), { what: 'the recording over the channel' });
    if (acknowledge) courier.postMessage({ type: 'delivered', id });
    return courier;
}

describe('the share tab opens before any network work', () => {
    it('fast network: tab first, then the upload completes, is registered under the page\'s id, and the document closes', async () => {
        await start();
        await record(12);
        const { before, id } = await stop();

        expect(before).not.toContain('/recordings/upload/complete');
        expect(before).not.toContain('/recordings');
        expect(id).toMatch(/^[0-9a-f-]{36}$/);

        const courier = await takeDelivery(id);
        expect(courier.received.find((m) => m.type === 'recording').blob.size).toBe(12 * MB);

        await h.waitFor(() => lastState() === 'registered', { what: 'registration' });
        expect(theUpload()).toMatchObject({ state: 'complete', bytes: 12 * MB });
        expect(registrations().map((c) => c.body.id)).toEqual([id]);
        expect(progress().map((p) => p.state)).toEqual(expect.arrayContaining(['uploading', 'completing', 'registering', 'registered']));

        await h.waitFor(() => !h.contexts.offscreen?.alive, { what: 'the offscreen document to close' });
        courier.close();
    });

    it('the recording is no longer marked as recording once the tab is open', async () => {
        await start();
        await record(3);
        await stop();
        await h.settle(50);
        expect(h.shared.local.get('isRecording')).toBe(false);
    });

    it('the document stays open until the page has the recording, even after the upload is done', async () => {
        await start();
        await record(6);
        const { id } = await stop();
        await h.waitFor(() => lastState() === 'registered', { what: 'registration' });
        await h.settle(200);
        expect(h.contexts.offscreen.alive).toBe(true);
        const courier = await takeDelivery(id);
        await h.waitFor(() => !h.contexts.offscreen?.alive, { what: 'the offscreen document to close' });
        courier.close();
    });
});

describe('a slow uplink: 36 minutes at 10.7 Mbit/s (2.9 GB) over 8 Mbit/s', () => {
    it('the tab opens at once; the backlog keeps uploading past the old 200 s cap and the recording is registered whole', async () => {
        const SCALE = 1000;                         // 2.9 GB runs as 2.9 MB
        await start({ byteScale: SCALE });
        h.net.uploadBps = 8e6;
        const perSecond = Math.round((10.7e6 / 8) / SCALE);
        for (let s = 0; s < 36 * 60; s++) {         // one timeslice per (scaled) second
            h.recorder().emit(perSecond);
            await new Promise((r) => setTimeout(r, 1000 / h.TIME_SCALE));
        }
        const recorded = perSecond * 36 * 60;
        const stoppedAt = Date.now();
        const { before, id } = await stop();
        expect(before).not.toContain('/recordings/upload/complete');

        const courier = await takeDelivery(id);
        await h.waitFor(() => lastState() === 'registered' || lastState() === 'failed', { what: 'the upload to settle', timeout: 60_000 });
        const virtualSeconds = ((Date.now() - stoppedAt) * h.TIME_SCALE) / 1000;

        expect(lastState()).toBe('registered');
        expect(theUpload()).toMatchObject({ state: 'complete', bytes: recorded });
        expect(virtualSeconds).toBeGreaterThan(200);           // past the old cap, and not aborted
        expect(progress().some((p) => p.state === 'uploading' && p.uploadedBytes < p.totalBytes)).toBe(true);
        courier.close();
    }, 120_000);
});

describe('failures after Stop', () => {
    it('offline at Stop: the tab opens, the upload fails and says so, nothing is registered, the page still gets the recording', async () => {
        await start();
        await record(12);
        h.net.offline = true;
        const { id } = await stop();
        const courier = await takeDelivery(id);
        await h.waitFor(() => lastState() === 'failed', { what: 'the failure to be reported', timeout: 8000 });
        expect(registrations()).toEqual([]);
        expect(theUpload().state).not.toBe('complete');
        expect(courier.received.find((m) => m.type === 'recording').blob.size).toBe(12 * MB);
        courier.close();
    });

    it('a failed final part is retried, and the recording is registered', async () => {
        await start();
        await record(12);
        h.net.failNext['r2.test'] = 1;
        const { id } = await stop();
        const courier = await takeDelivery(id);
        await h.waitFor(() => lastState() === 'registered', { what: 'registration', timeout: 8000 });
        expect(theUpload()).toMatchObject({ state: 'complete', bytes: 12 * MB });
        expect(h.events().filter((e) => e.event === 'upload_part_failed')).toHaveLength(1);
        courier.close();
    });
});

describe('recording again while the last one is still finishing', () => {
    it('each recording keeps its own upload; both complete, and recovery leaves both alone', async () => {
        const SCALE = 100;
        await start({ byteScale: SCALE });
        h.net.uploadBps = 2e6;                          // slow enough that the first is still going
        const chunk = Math.round(MB / SCALE);           // 1 MB a second, scaled
        for (let i = 0; i < 60; i++) { h.recorder().emit(chunk); await h.settle(15); }
        const first = await stop();
        const firstCourier = await takeDelivery(first.id);
        const firstUpload = theUpload().fileName;

        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'second recorder' });
        await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 2, { what: 'second upload to open' });
        // A worker restart now must not "recover" the first upload, which is live.
        h.terminateWorker();
        h.bootWorker();
        await h.settle(100);
        for (let i = 0; i < 6; i++) { h.recorder().emit(chunk); await h.settle(15); }

        await h.waitFor(() => registrations().some((c) => c.body.id === first.id), { what: 'the first registration', timeout: 30_000 });
        const uploads = [...h.net.uploads.values()];
        expect(uploads.find((u) => u.fileName === firstUpload)).toMatchObject({ state: 'complete', bytes: 60 * chunk });
        expect(uploads.at(-1).state).toBe('open');      // the second is recording, untouched
        expect(registrations()).toHaveLength(1);         // no recovered duplicate
        expect(h.contexts.offscreen.alive).toBe(true);   // not closed under the new recording
        firstCourier.close();
    }, 60_000);
});

describe('a page that never takes the recording', () => {
    it('closed before it loaded: the document stops waiting, finishes the upload, and closes', async () => {
        await start({ tabLoadMs: 2_000 });
        await record(6);
        const { shareTab } = await stop();
        await h.sw(`chrome.tabs.remove(${shareTab.id})`);
        await h.waitFor(() => lastState() === 'registered', { what: 'registration' });
        await h.waitFor(() => !h.contexts.offscreen?.alive, { what: 'the offscreen document to close' });
        expect(h.injections).toEqual([]);
        expect(h.downloads).toEqual([]);
    });

    it('a frame that cannot be injected: the recording goes to Downloads, from memory', async () => {
        await start({ tabLoadMs: 0, injectionFails: true });
        await record(6);
        await stop();
        await h.waitFor(() => h.downloads.length === 1, { what: 'the disk copy' });
        // The notice follows the download finishing, not starting.
        await h.waitFor(() => h.notifications.some((n) => n.id === 'snaprec-handoff-fallback'), { what: 'the saved-to-disk notice' });
        await h.waitFor(() => !h.contexts.offscreen?.alive, { what: 'the offscreen document to close' });
    });
});
