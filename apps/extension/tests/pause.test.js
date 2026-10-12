import { afterEach, describe, expect, it } from 'vitest';
import { createHarness } from './harness/extensionHarness.js';

/** Pause and resume reach the recorder.
 *
 * The in-page bar and the popup send pauseRecording / resumeRecording to the
 * worker, whose handler called functions a refactor had removed: it threw,
 * the bar showed "paused", and the recorder kept recording. Real worker and
 * offscreen document in the harness. */

let h;
afterEach(() => h?.dispose());

async function recording() {
    h = createHarness();
    await h.sw('startRecording({ microphone: false, systemAudio: false })');
    await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'the recorder' });
}

describe('pause and resume', () => {
    it('pause from the page pauses the recorder', async () => {
        await recording();
        await h.fromContent({ action: 'pauseRecording' });
        await h.waitFor(() => h.recorder().state === 'paused', { what: 'the recorder to pause' });
        expect(h.shared.local.get('isPaused')).toBe(true);
    });

    it('resume from the page resumes it', async () => {
        await recording();
        await h.fromContent({ action: 'pauseRecording' });
        await h.waitFor(() => h.recorder().state === 'paused', { what: 'paused' });
        await h.fromContent({ action: 'resumeRecording' });
        await h.waitFor(() => h.recorder().state === 'recording', { what: 'the recorder to resume' });
        expect(h.shared.local.get('isPaused')).toBe(false);
    });

    it('a new recording does not start paused', async () => {
        await recording();
        await h.fromContent({ action: 'pauseRecording' });
        await h.waitFor(() => h.recorder().state === 'paused', { what: 'paused' });
        await h.fromContent({ action: 'stopRecording' }).catch(() => {});
        await h.waitFor(() => h.tabs.some((t) => t.url.includes('/v')), { what: 'the share tab' });
        expect(h.shared.local.get('isPaused') ?? false).toBe(false);
    });
});
