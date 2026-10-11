import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** Controls around a recording's start and end that the recording panel needs.
 *
 * Real worker and offscreen document in the harness, timers 10x fast so the
 * 3.5 s countdown leaves room to act during it. */

let h;
afterEach(() => h?.dispose());

async function startAndWaitForCountdown(options = { microphone: false, systemAudio: false }) {
    h = createHarness({ timeScale: 10 });
    void h.sw(`startRecording(${JSON.stringify(options)})`);
    await h.waitFor(() => h.tabMessages.some((m) => m.message?.action === 'showCountdown'), { what: 'the countdown' });
}

describe('cancelling during the countdown', () => {
    it('nothing is recorded or uploaded, the capture is released, and the page is told', async () => {
        await startAndWaitForCountdown();
        await h.fromContent({ action: 'cancelCountdown' });
        await h.settle(600);                              // past where the countdown would have ended

        expect(h.recorder()?.state ?? 'none').not.toBe('recording');
        expect(h.apiCalls('/recordings/upload/begin')).toEqual([]);
        expect(h.contexts.offscreen?.alive ?? false).toBe(false);
        expect(h.shared.local.get('isRecording') ?? false).toBe(false);
        expect(h.tabMessages.some((m) => m.message?.action === 'hideCountdown')).toBe(true);
        expect(h.events().some((e) => e.event === 'recording_cancelled' && e.properties.stage === 'countdown')).toBe(true);
    });

    it('a cancel with no countdown running changes nothing', async () => {
        h = createHarness({ timeScale: 10 });
        await h.fromContent({ action: 'cancelCountdown' });
        await h.settle(50);
        expect(h.contexts.offscreen?.alive ?? false).toBe(false);
    });
});

describe('a start that fails while the last recording is still finishing', () => {
    it('dismissing the picker does not close the document out from under the earlier upload', async () => {
        h = createHarness({ byteScale: 100 });
        await h.sw('startRecording({ microphone: false, systemAudio: false })');
        await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'first recorder' });
        h.net.uploadBps = 2e6;                                   // the first one is slow to finish
        for (let i = 0; i < 60; i++) { h.recorder().emit(Math.round(1024 * 1024 / 100)); await h.settle(15); }
        void h.fromContent({ action: 'stopRecording' }).catch(() => {});
        await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
        const id = new URL(h.tabs.find((t) => t.url.includes('/v')).url).searchParams.get('r');

        h.media.dismissPicker = true;
        await h.sw('startRecording({ microphone: false, systemAudio: false })');   // the user closes the picker

        expect(h.contexts.offscreen.alive).toBe(true);
        await h.waitFor(() => h.apiCalls('/recordings').some((c) => c.body.id === id), { what: 'the first recording registered', timeout: 30_000 });
    }, 60_000);
});
