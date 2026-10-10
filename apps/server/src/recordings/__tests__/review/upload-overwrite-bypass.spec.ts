import { StorageService } from '../../../storage/storage.service';

/** Review finding #7 — the existence check behind 08a1a71's 409 failed open.
 *
 * These use the REAL StorageService. Presigning is pure local crypto in the
 * AWS SDK, so no request leaves the process; the S3 client's send() is
 * replaced where a test needs an R2 answer. */

function realStorage() {
    const env: Record<string, string> = {
        R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET_NAME: 'snaprec',
    };
    return new StorageService({ get: (k: string) => env[k] } as any);
}

describe('StorageService.checkFileExists, which the 409 relies on', () => {
    /* It returns false for ANY error — throttling, 5xx, a 403 from a rotated
     * key — not just 404. refuseExistingKey therefore fails open: during an R2
     * hiccup upload-url/begin/complete sign and complete over an existing key. */
    it('does not report "absent" when R2 answers 503', async () => {
        const s = realStorage();
        (s as any).s3Client.send = jest.fn().mockRejectedValue(
            Object.assign(new Error('Service Unavailable'), { name: 'ServiceUnavailable', $metadata: { httpStatusCode: 503 } }));
        await expect(s.checkFileExists('video-x.webm')).rejects.toBeDefined();
    });

    const r2Error = (status: number, name: string) =>
        Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });

    it('reports absent for a clear 404', async () => {
        const s = realStorage();
        (s as any).s3Client.send = jest.fn().mockRejectedValue(r2Error(404, 'NotFound'));
        await expect(s.checkFileExists('video-x.webm')).resolves.toBe(false);
    });

    it.each([[403, 'Forbidden'], [429, 'SlowDown'], [500, 'InternalError'], [0, 'TimeoutError']])(
        'does not report absent for %s %s', async (status, name) => {
            const s = realStorage();
            (s as any).s3Client.send = jest.fn().mockRejectedValue(r2Error(status, name));
            await expect(s.checkFileExists('video-x.webm')).rejects.toBeDefined();
        });

    it('reports present when R2 answers the HEAD', async () => {
        const s = realStorage();
        (s as any).s3Client.send = jest.fn().mockResolvedValue({});
        await expect(s.checkFileExists('video-x.webm')).resolves.toBe(true);
    });
});
