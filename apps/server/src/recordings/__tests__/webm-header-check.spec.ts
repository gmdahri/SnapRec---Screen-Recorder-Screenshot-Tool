import { Logger } from '@nestjs/common';
import { writeEndpointsApp } from './support/write-endpoints-app';

/** A completed webm that does not start with the WebM header is refused.
 *
 * Extension v2.0.9 drops whatever it records before upload/begin answers, and
 * the first chunk carries the header. Such an upload still completes, so the
 * extension registered a recording whose file plays nowhere — a dead share
 * link. upload/complete now reads the first four bytes of what it just wrote
 * and, for video/webm only, deletes a headerless file and answers 422. The
 * extension then aborts and registers nothing, and the share page keeps the
 * playable local copy, which can still be uploaded from there.
 *
 * Only the extension calls the multipart endpoints, always as video/webm.
 * The web app (share page, screenshot editor, video editor) uploads through
 * upload-url, which this does not touch. */

const EBML = Buffer.from('1a45dfa3', 'hex');
const MID_STREAM = Buffer.from('20b5148103e10086004092', 'hex');

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
let warnings: string[];
beforeEach(async () => {
    t = await writeEndpointsApp();
    warnings = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m: any) => { warnings.push(String(m)); });
});
afterEach(async () => {
    delete process.env.WEBM_HEADER_CHECK;
    jest.restoreAllMocks();
    await t.close();
});

async function streamed(fileName: string, contentType: string, body?: Buffer) {
    const begun = await t.call('post', '/recordings/upload/begin', { fileName, contentType });
    if (body) t.r2.assembled.set(begun.body.uploadId, body);
    const done = await t.call('post', '/recordings/upload/complete', {
        fileName, uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
    });
    return { uploadId: begun.body.uploadId as string, done };
}

describe('a completed webm without its header', () => {
    it('is deleted and refused with 422, with a log line', async () => {
        const { done } = await streamed('video-a.webm', 'video/webm', MID_STREAM);
        expect(done.status).toBe(422);
        expect(t.r2.objects.has('video-a.webm')).toBe(false);
        expect(warnings.filter((w) => w.includes('video-a.webm') && w.includes('Deleted'))).toHaveLength(1);
    });

    it('a codecs parameter on the content type is still webm', async () => {
        const { done } = await streamed('video-b.webm', 'video/webm;codecs=vp9', MID_STREAM);
        expect(done.status).toBe(422);
        expect(t.r2.objects.has('video-b.webm')).toBe(false);
    });

    it('nothing can be registered on it afterwards: the key is empty again', async () => {
        await streamed('video-c.webm', 'video/webm', MID_STREAM);
        expect(await t.r2.checkFileExists('video-c.webm')).toBe(false);
    });

    it('a failed delete is logged and still refused', async () => {
        t.r2.deleteObject = async () => { throw new Error('R2 down'); };
        const { done } = await streamed('video-d.webm', 'video/webm', MID_STREAM);
        expect(done.status).toBe(422);
        expect(warnings.some((w) => w.includes('video-d.webm') && w.includes('could not delete'))).toBe(true);
    });
});

describe('what is left alone', () => {
    it('a webm that starts with its header', async () => {
        const { done } = await streamed('video-ok.webm', 'video/webm', Buffer.concat([EBML, MID_STREAM]));
        expect(done.status).toBe(201);
        expect(t.r2.objects.has('video-ok.webm')).toBe(true);
    });

    it('anything that is not video/webm, whatever its first bytes', async () => {
        const { done } = await streamed('clip.mp4', 'video/mp4', MID_STREAM);
        expect(done.status).toBe(201);
        expect(t.r2.objects.has('clip.mp4')).toBe(true);
    });

    it('with the kill switch WEBM_HEADER_CHECK=off', async () => {
        process.env.WEBM_HEADER_CHECK = 'off';
        const read = jest.spyOn(t.r2, 'readHead');
        const { done } = await streamed('video-off.webm', 'video/webm', MID_STREAM);
        expect(done.status).toBe(201);
        expect(t.r2.objects.has('video-off.webm')).toBe(true);
        expect(read).not.toHaveBeenCalled();
    });

    it('when R2 cannot be read back: kept and logged, never deleted on a guess', async () => {
        t.r2.readHead = async () => { throw new Error('Service Unavailable'); };
        const del = jest.spyOn(t.r2, 'deleteObject');
        const { done } = await streamed('video-unread.webm', 'video/webm', MID_STREAM);
        expect(done.status).toBe(201);
        expect(del).not.toHaveBeenCalled();
        expect(warnings.some((w) => w.includes('video-unread.webm'))).toBe(true);
    });

    it('a key that was not verified empty first: refused before anything is read or deleted', async () => {
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-taken.webm', contentType: 'video/webm' });
        t.r2.objects.set('video-taken.webm', MID_STREAM);
        t.r2.contentTypes.set('video-taken.webm', 'video/webm');
        const read = jest.spyOn(t.r2, 'readHead');
        const del = jest.spyOn(t.r2, 'deleteObject');
        const done = await t.call('post', '/recordings/upload/complete', {
            fileName: 'video-taken.webm', uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(done.status).toBe(409);
        expect(read).not.toHaveBeenCalled();
        expect(del).not.toHaveBeenCalled();
        expect(t.r2.objects.get('video-taken.webm')).toBe(MID_STREAM);
    });

    it('when R2 cannot say whether the key is empty: 503, nothing read or deleted', async () => {
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-unknown.webm', contentType: 'video/webm' });
        t.r2.checkFileExists = async () => { throw Object.assign(new Error('Service Unavailable'), { $metadata: { httpStatusCode: 503 } }); };
        const read = jest.spyOn(t.r2, 'readHead');
        const del = jest.spyOn(t.r2, 'deleteObject');
        const done = await t.call('post', '/recordings/upload/complete', {
            fileName: 'video-unknown.webm', uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(done.status).toBe(503);
        expect(read).not.toHaveBeenCalled();
        expect(del).not.toHaveBeenCalled();
    });

    it('presigned single uploads (the web app) are not checked', async () => {
        const read = jest.spyOn(t.r2, 'readHead');
        const res = await t.call('post', '/recordings/upload-url', { fileName: 'video-web.webm', contentType: 'video/webm' });
        expect(res.status).toBe(201);
        expect(read).not.toHaveBeenCalled();
    });
});
