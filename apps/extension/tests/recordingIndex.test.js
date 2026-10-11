// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHarness } from './harness/extensionHarness.js';

/** A real recording, end to end: its duration and seek index reach both the
 * copy handed to the share page and the file R2 assembles.
 *
 * The real worker and offscreen document in the harness, fed a real Chrome
 * MediaRecorder recording (7 s, VP9 + Opus) in recorder-sized chunks. */

const FIXTURE = readFileSync(resolve(__dirname, 'fixtures/mediarecorder-7s.webm'));
const PART = 64 * 1024;          // parts this small so the recording spans several
let h;
afterEach(() => h?.dispose());

const hasDuration = (b) => b.indexOf(Buffer.from([0x44, 0x89, 0x88])) > 0 && b.indexOf(Buffer.from([0x44, 0x89, 0x88])) < 400;
const endsWithCues = (b) => b.lastIndexOf(Buffer.from([0x1c, 0x53, 0xbb, 0x6b])) > b.length - 200;

async function recordFixture({ byteScale }) {
    h = createHarness({ byteScale });
    h.net.keepBodies = true;
    await h.sw('startRecording({ microphone: false, systemAudio: false })');
    await h.waitFor(() => h.recorder()?.state === 'recording', { what: 'recorder to start' });
    await h.waitFor(() => h.apiCalls('/recordings/upload/begin').length === 1, { what: 'upload to open' });
    for (let i = 0; i < FIXTURE.length; i += 14_000) {          // ~1 s timeslices of this recording
        h.recorder().emit(FIXTURE.subarray(i, i + 14_000));
        await h.settle(20);
    }
    void h.fromContent({ action: 'stopRecording' }).catch(() => {});
    await h.waitFor(() => h.injections.length === 1, { what: 'the courier frame' });
    const id = new URL(h.injections[0].frameUrl).searchParams.get('id');
    const courier = h.channel('snaprec-handoff');
    courier.postMessage({ type: 'want', id });
    await h.waitFor(() => courier.received.some((m) => m.type === 'recording'), { what: 'the recording' });
    const local = Buffer.from(await courier.received.find((m) => m.type === 'recording').blob.arrayBuffer());
    courier.postMessage({ type: 'delivered', id });
    await h.waitFor(() => h.channelLog.some((m) => m.data.type === 'progress' && m.data.state === 'registered'), { what: 'registration', timeout: 10_000 });
    const up = [...h.net.uploads.values()].at(-1);
    const remote = Buffer.concat(up.completedParts.map((n) => Buffer.from(up.bodies.get(n))));
    courier.close();
    return { local, remote, up };
}

describe('a recording\'s duration and seek index', () => {
    it('are in the copy the page gets and in the file on R2, which are the same bytes', async () => {
        // byteScale makes the 5 MB part size 64 KB here.
        const { local, remote, up } = await recordFixture({ byteScale: (5 * 1024 * 1024) / PART });
        expect(up.completedParts.length).toBeGreaterThan(1);
        expect(hasDuration(local)).toBe(true);
        expect(endsWithCues(local)).toBe(true);
        expect(remote.equals(local)).toBe(true);
        // The recording's own bytes, untouched, between the grown header and the index.
        const cuesAt = local.lastIndexOf(Buffer.from([0x1c, 0x53, 0xbb, 0x6b]));
        expect(local.subarray(188 + 56, cuesAt).equals(FIXTURE.subarray(188))).toBe(true);
        // Part 1 went up while recording, then once more with the patched header.
        const partOnes = h.net.calls.filter((c) => c.url.startsWith(h.R2) && c.partNumber === 1);
        expect(partOnes).toHaveLength(2);
    });

    it('a recording that fits in one part gets them too, without sending anything twice', async () => {
        const { local, remote, up } = await recordFixture({ byteScale: 1 });
        expect(up.completedParts).toEqual([1]);
        expect(hasDuration(remote)).toBe(true);
        expect(endsWithCues(remote)).toBe(true);
        expect(remote.equals(local)).toBe(true);
        expect(h.net.calls.filter((c) => c.url.startsWith(h.R2)).length).toBe(1);
    });
});
