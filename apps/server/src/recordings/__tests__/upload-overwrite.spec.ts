import { writeEndpointsApp } from './support/write-endpoints-app';

/** Finding 1 — anyone could overwrite any stored file.
 *
 * The upload endpoints take the object key from the request body and sign
 * whatever they are given, with no account required (guests upload too). A
 * share link is enough to learn a recording's key — GET /recordings/:id puts
 * it in the signed URL's path — so the holder of any link could ask for a
 * presigned PUT to that key and replace the video behind it for everyone.
 *
 * The guard is "never for a key that already holds a file". Every legitimate
 * uploader names a fresh key, so nothing that works today depends on writing
 * over an existing one. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

describe('replacing someone else’s file', () => {
    it('presigned PUT: the share link’s key is refused', async () => {
        const { id, key } = await t.victim({ owner: 'sb-owner' });
        expect(await t.keyFromShareLink(id)).toBe(key);   // the leak this relies on

        const res = await t.call('post', '/recordings/upload-url', { fileName: key, contentType: 'video/webm' });
        expect(res.status).toBe(409);
        expect(t.r2.signedPuts).not.toContain(key);
    });

    it('multipart: an upload opened on an existing key can never be completed onto it', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const key = await t.keyFromShareLink(id);
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: key, contentType: 'video/webm' });
        const part = await t.call('post', '/recordings/upload/part', { fileName: key, uploadId: begun.body.uploadId, partNumber: 1 });
        expect(part.status).toBe(201);
        const res = await t.call('post', '/recordings/upload/complete', {
            fileName: key, uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(res.status).toBe(409);
        expect(t.r2.objects.get(key)).toBe('victim');
    });

    it('multipart: completing onto a key that has since been filled is refused', async () => {
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-x.webm', contentType: 'video/webm' });
        t.r2.objects.set('video-x.webm', 'someone else got there first');
        const res = await t.call('post', '/recordings/upload/complete', {
            fileName: 'video-x.webm', uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(res.status).toBe(409);
        expect(t.r2.objects.get('video-x.webm')).toBe('someone else got there first');
    });
});

describe('what uploaders do today keeps working', () => {
    /* Extension v2.0.9 queues recorded chunks for upload only once
     * upload/begin has answered, so whatever it records while begin is in
     * flight never reaches R2 — and the first second holds the WebM header.
     * Every R2 round trip begin makes widens that window. The existence check
     * that keeps a file from being overwritten belongs on complete, which is
     * what writes the object; begin writes nothing. */
    it('upload/begin opens the upload without first asking R2 about the key', async () => {
        const asked: string[] = [];
        const check = t.r2.checkFileExists;
        t.r2.checkFileExists = async (key: string) => { asked.push(key); return check(key); };
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-new.webm', contentType: 'video/webm' });
        expect(begun.status).toBe(201);
        expect(asked).toEqual([]);
    });

    it('a fresh key is signed', async () => {
        const res = await t.call('post', '/recordings/upload-url', { fileName: 'screenshot-1.png', contentType: 'image/png' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ fileUrl: 'screenshot-1.png', uploadUrl: expect.stringContaining('screenshot-1.png') });
    });

    it('a streamed upload opens, takes parts and completes', async () => {
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-new.webm', contentType: 'video/webm' });
        expect(begun.status).toBe(201);
        const part = await t.call('post', '/recordings/upload/part', { fileName: 'video-new.webm', uploadId: begun.body.uploadId, partNumber: 1 });
        expect(part.status).toBe(201);
        const done = await t.call('post', '/recordings/upload/complete', {
            fileName: 'video-new.webm', uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(done.status).toBe(201);
        expect(t.r2.objects.has('video-new.webm')).toBe(true);
    });
});
