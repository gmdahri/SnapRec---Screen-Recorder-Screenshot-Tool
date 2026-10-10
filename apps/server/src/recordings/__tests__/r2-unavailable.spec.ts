import { writeEndpointsApp } from './support/write-endpoints-app';

/** When R2 cannot say whether a key exists, the upload endpoints fail closed.
 *
 * The check behind their 409 used to read every R2 error as "no such key", so
 * during an outage, a throttle or a credentials problem they signed and
 * completed uploads over files that exist. Now an unclear answer is a 503 and
 * nothing is signed. The share page's isReady is the one reader that degrades
 * instead — to "not ready yet" — because it decides nothing and a 503 there
 * would take every share page down with R2. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => {
    t = await writeEndpointsApp();
});
afterEach(async () => { await t.close(); });

const r2Down = () => {
    t.r2.checkFileExists = async () => { throw Object.assign(new Error('Service Unavailable'), { $metadata: { httpStatusCode: 503 } }); };
};

describe('R2 cannot answer', () => {
    it('upload-url -> 503, nothing signed', async () => {
        r2Down();
        const res = await t.call('post', '/recordings/upload-url', { fileName: 'video-new.webm', contentType: 'video/webm' });
        expect(res.status).toBe(503);
        expect(t.r2.signedPuts).toEqual([]);
    });

    it('upload/begin -> 503, nothing opened', async () => {
        r2Down();
        const res = await t.call('post', '/recordings/upload/begin', { fileName: 'video-new.webm', contentType: 'video/webm' });
        expect(res.status).toBe(503);
        expect(t.r2.uploads.size).toBe(0);
    });

    it('upload/complete -> 503, nothing written', async () => {
        const begun = await t.call('post', '/recordings/upload/begin', { fileName: 'video-new.webm', contentType: 'video/webm' });
        r2Down();
        const res = await t.call('post', '/recordings/upload/complete', {
            fileName: 'video-new.webm', uploadId: begun.body.uploadId, parts: [{ PartNumber: 1, ETag: '"e1"' }],
        });
        expect(res.status).toBe(503);
        expect(t.r2.objects.has('video-new.webm')).toBe(false);
    });

    it('the readiness probe -> 503, not "not ready"', async () => {
        r2Down();
        const res = await t.call('get', '/recordings/status/video-new.webm');
        expect(res.status).toBe(503);
    });

    it('the share page still loads, showing the file as not ready yet', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        r2Down();
        const res = await t.call('get', `/recordings/${id}`);
        expect(res.status).toBe(200);
        expect(res.body.isReady).toBe(false);
    });
});
