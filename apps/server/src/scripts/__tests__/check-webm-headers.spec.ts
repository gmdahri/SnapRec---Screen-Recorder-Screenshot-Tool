import { checkAll, checkOne, report } from '../check-webm-headers';

/** The read-only header check: verdicts, and a report that carries ids and
 * times only — never a key. */

const head = (contentType: string | undefined, hex: string) => async () => ({ contentType, bytes: new Uint8Array(Buffer.from(hex, 'hex')) });
const fail = (e: object) => async () => { throw Object.assign(new Error('x'), e); };

describe('checkOne', () => {
    it.each([
        ['ok', head('video/webm', '1a45dfa3')],
        ['ok', head('video/webm;codecs=vp9', '1a45dfa3')],
        ['no_header', head('video/webm', '20b51481')],
        ['no_header', head('video/webm', '')],
        ['not_webm', head('video/mp4', '00000020')],
        ['missing', fail({ name: 'NoSuchKey' })],
        ['missing', fail({ $metadata: { httpStatusCode: 404 } })],
        ['unreadable', fail({ name: 'SlowDown', $metadata: { httpStatusCode: 503 } })],
    ])('%s', async (expected, read) => {
        expect(await checkOne('video-x.webm', read as any)).toBe(expected);
    });

    it('a full URL is not read as a key', async () => {
        const read = jest.fn();
        expect(await checkOne('https://example.test/video.webm', read)).toBe('not_a_key');
        expect(read).not.toHaveBeenCalled();
    });

    it('asks for four bytes', async () => {
        const read = jest.fn(head('video/webm', '1a45dfa3'));
        await checkOne('video-x.webm', read);
        expect(read).toHaveBeenCalledWith('video-x.webm', 4);
    });
});

describe('report', () => {
    it('counts every status and lists failures by id and time, without keys', async () => {
        const rows = [
            { id: 'r-ok', fileUrl: 'video-ok-secretish.webm', createdAt: new Date('2026-10-11T19:00:00Z') },
            { id: 'r-bad', fileUrl: 'video-bad-secretish.webm', createdAt: new Date('2026-10-11T18:44:00Z') },
            { id: 'r-gone', fileUrl: 'video-gone-secretish.webm', createdAt: new Date('2026-10-12T01:00:00Z') },
        ];
        const read = async (key: string) => {
            if (key.includes('gone')) throw Object.assign(new Error('x'), { name: 'NoSuchKey' });
            return { contentType: 'video/webm', bytes: new Uint8Array(Buffer.from(key.includes('bad') ? '20b51481' : '1a45dfa3', 'hex')) };
        };
        const out = report(await checkAll(rows, read), '2026-10-11T18:30:00Z');
        expect(out).toContain('Video recordings created since 2026-10-11T18:30:00Z: 3');
        expect(out).toMatch(/no_header\s+1/);
        expect(out).toMatch(/missing\s+1/);
        expect(out).toMatch(/ok\s+1/);
        expect(out).toContain('r-bad  2026-10-11T18:44:00.000Z');
        expect(out).toContain('r-gone  2026-10-12T01:00:00.000Z');
        expect(out).not.toContain('r-ok');
        expect(out).not.toContain('secretish');
    });
});
