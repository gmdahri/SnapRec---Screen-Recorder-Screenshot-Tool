import { describe, expect, it } from 'vitest';
import { describeUpload, isSlow, SLOW_AFTER_MS } from '../lib/uploadStatus';

/** The status line for an upload finishing after Stop, and when it is slow. */

const MB = 1024 * 1024;
const samplesAt = (bytesPerSecond: number, seconds: number) =>
    Array.from({ length: seconds + 1 }, (_, s) => ({ at: s * 1000, uploadedBytes: s * bytesPerSecond }));

describe('isSlow', () => {
    it('never before 15 s of uploading, however little has moved', () => {
        expect(isSlow(samplesAt(0, 14), 14_000)).toBe(false);
    });

    it('8 Mbit/s is not slow', () => {
        expect(isSlow(samplesAt(1_000_000, 30), 30_000)).toBe(false);
    });

    it('under 1 Mbit/s over the last 15 s is slow', () => {
        expect(isSlow(samplesAt(60_000, 30), 30_000)).toBe(true);   // 0.48 Mbit/s
    });

    it('judges the last 15 s, not the whole upload: fast then crawling is slow', () => {
        const fast = samplesAt(2_000_000, 20);
        const last = fast[fast.length - 1];
        const crawl = Array.from({ length: 20 }, (_, i) => ({ at: last.at + (i + 1) * 1000, uploadedBytes: last.uploadedBytes + (i + 1) * 10_000 }));
        expect(isSlow([...fast, ...crawl], last.at + 20_000)).toBe(true);
    });

    it('no samples is not slow', () => {
        expect(isSlow([], SLOW_AFTER_MS * 2)).toBe(false);
    });
});

describe('describeUpload', () => {
    it('uploading: says how much of how much, with a percentage', () => {
        const v = describeUpload({ state: 'uploading', uploadedBytes: 120 * MB, totalBytes: 184 * MB }, samplesAt(4 * MB, 10), 10_000);
        expect(v).toMatchObject({ phase: 'finishing', slow: false, percent: 65 });
        expect(v.label).toBe('Finishing your recording — uploading 120 of 184 MB');
    });

    it('slow: says so, and that the recording is safe here', () => {
        const v = describeUpload({ state: 'uploading', uploadedBytes: 2 * MB, totalBytes: 184 * MB }, samplesAt(50_000, 40), 40_000);
        expect(v.slow).toBe(true);
        expect(v.label).toMatch(/^Uploading slowly/);
        expect(v.detail).toMatch(/safe on this device/);
    });

    it('completing and registering: almost done', () => {
        expect(describeUpload({ state: 'completing' }, [], 0).label).toMatch(/almost done/);
        expect(describeUpload({ state: 'registering' }, [], 0).label).toMatch(/almost done/);
    });

    it('registered: the link is ready', () => {
        expect(describeUpload({ state: 'registered' }, [], 0)).toMatchObject({ phase: 'registered', percent: 100 });
    });

    it.each([
        ['stalled', /stopped moving/],
        ['retries_exhausted', /kept failing/],
        ['session_expired', /session expired/i],
        ['something_new', /went wrong/],
    ])('failed (%s): says why, and that the recording is still here', (reason, why) => {
        const v = describeUpload({ state: 'failed', reason }, [], 0);
        expect(v.phase).toBe('failed');
        expect(v.detail).toMatch(why);
        expect(v.detail).toMatch(/still on this device/);
    });

    it('small sizes keep a decimal', () => {
        expect(describeUpload({ state: 'uploading', uploadedBytes: 1.5 * MB, totalBytes: 4 * MB }, [], 0).label).toContain('1.5 of 4.0 MB');
    });
});
