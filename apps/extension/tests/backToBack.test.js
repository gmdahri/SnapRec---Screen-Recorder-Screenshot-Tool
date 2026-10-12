import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** A recording started while the previous one is still uploading.
 *
 * A slow uplink keeps recording A's upload going long after Stop, and the
 * user can start recording B meanwhile. B must upload through its own
 * uploader: A's has stopped accepting bytes, so anything pushed to it is
 * dropped, and B's upload would be aborted as empty. */

const MB = 1024 * 1024;
const SCALE = 100;
let h;
afterEach(() => h?.dispose());

async function stop(n) {
    void h.fromContent({ action: 'stopRecording' }).catch(() => {});
    await h.waitFor(() => h.tabs.filter((t) => t.url.includes('/v')).length >= n, { what: 'the share tab' });
    return new URL(h.tabs.filter((t) => t.url.includes('/v')).at(-1).url).searchParams.get('r');
}
async function deliver(id) {
    const courier = h.channel('snaprec-handoff');
    courier.postMessage({ type: 'want', id });
    await h.waitFor(() => courier.received.some((m) => m.type === 'recording' && m.id === id), { what: 'the recording' });
    courier.postMessage({ type: 'delivered', id });
    return courier;
}
const lastProgress = (id) => h.channelLog.filter((m) => m.data.type === 'progress' && m.data.id === id).at(-1)?.data;

describe('recording B while A is still uploading', () => {
    it('uploads and registers B with its own bytes', async () => {
        h = createHarness({ byteScale: SCALE });
        const chunk = Math.round(MB / SCALE);
        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder A' });
        await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'upload A' });
        h.net.uploadBps = 2e6;
        for (let i = 0; i < 60; i++) { h.recorder().emit(chunk); await h.settle(15); }
        const a = await stop(1);
        const ca = await deliver(a);

        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder B' });
        await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 2, { what: 'upload B' });
        expect(h.offscreen('finishingUploaders.size')).toBe(1);   // A is still finishing
        for (let i = 0; i < 20; i++) { h.recorder().emit(chunk); await h.settle(15); }
        const b = await stop(2);
        const cb = await deliver(b);

        await h.waitFor(() => ['registered', 'failed'].includes(lastProgress(b)?.state), { what: 'B to settle', timeout: 30_000 });
        expect(lastProgress(b)).toMatchObject({ state: 'registered' });
        await h.waitFor(() => ['registered', 'failed'].includes(lastProgress(a)?.state), { what: 'A to settle', timeout: 30_000 });
        expect(lastProgress(a)).toMatchObject({ state: 'registered' });
        ca.close(); cb.close();
    }, 60_000);
});
