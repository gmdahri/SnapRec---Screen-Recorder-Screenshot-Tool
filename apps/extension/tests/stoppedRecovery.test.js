import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** The offscreen document dies while it is still sending a stopped
 * recording's last parts.
 *
 * By then the share page holds the whole recording, and part 1 may already
 * carry the patched header: a Duration for the full length and a seek index
 * placed after the last byte. Completing the parts that made it would
 * register a cut-off file whose index points past its end, under an id the
 * page is not waiting for. Recovery leaves a stopped recording's upload
 * alone: it aborts it and registers nothing. */

const MB = 1024 * 1024;
const SCALE = 100;
let h;
afterEach(() => h?.dispose());

describe('a crash after Stop, before the upload finished', () => {
    it('is not completed or registered by recovery', async () => {
        h = createHarness({ byteScale: SCALE, tabLoadMs: 0 });
        const chunk = Math.round(MB / SCALE);
        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'the recorder' });
        await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'the upload' });
        h.net.uploadBps = 2e6;
        for (let i = 0; i < 60; i++) { h.recorder().emit(chunk); await h.settle(15); }
        void h.fromContent({ action: 'stopRecording' }).catch(() => {});
        await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
        const id = new URL(h.tabs.find((t) => t.url.includes('/v')).url).searchParams.get('r');
        const courier = h.channel('snaprec-handoff');
        courier.postMessage({ type: 'want', id });
        await h.waitFor(() => courier.received.some((m) => m.type === 'recording'), { what: 'the recording' });
        courier.postMessage({ type: 'delivered', id });
        await h.waitFor(() => h.channelLog.some((m) => m.data.type === 'progress' && m.data.state === 'uploading'), { what: 'the drain' });
        await h.settle(200);

        h.killOffscreen();
        h.terminateWorker(); h.bootWorker();
        await h.waitFor(() => h.apiCalls('/recordings/upload/abort').length === 1, { what: 'recovery to abort it', timeout: 10_000 });
        await h.settle(300);
        expect(h.apiCalls('/recordings/upload/complete')).toEqual([]);
        expect([...h.net.rows.values()]).toEqual([]);
        expect([...h.net.uploads.values()][0].state).toBe('aborted');
        courier.close();
    }, 30_000);
});
