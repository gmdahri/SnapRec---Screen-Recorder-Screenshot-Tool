import { StorageService } from '../storage.service';

/** The four calls that make a streamed recording possible.
 *
 * Asserted against a stubbed S3 client rather than R2 itself: what matters
 * here is that each command carries the right bucket, key and part number,
 * and that abort is reachable — an upload that is never completed or aborted
 * bills for its parts invisibly until the bucket's lifecycle rule sweeps it.
 */

const config = {
  get: (k: string) => ({
    R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET_NAME: 'bucket',
  } as Record<string, string>)[k],
} as any;

function serviceWithStub() {
  const sent: any[] = [];
  const svc = new StorageService(config);
  (svc as any).s3Client = {
    send: async (cmd: any) => {
      sent.push(cmd);
      if (cmd.constructor.name === 'CreateMultipartUploadCommand') return { UploadId: 'upl-1' };
      return {};
    },
  };
  return { svc, sent };
}

describe('multipart upload', () => {
  it('opens an upload and returns the id R2 gave it', async () => {
    const { svc, sent } = serviceWithStub();
    await expect(svc.createMultipartUpload('a.webm', 'video/webm')).resolves.toBe('upl-1');
    expect(sent[0].input).toMatchObject({
      Bucket: 'bucket', Key: 'a.webm', ContentType: 'video/webm',
    });
  });

  it('fails loudly when R2 returns no upload id', async () => {
    const { svc } = serviceWithStub();
    (svc as any).s3Client.send = async () => ({});
    await expect(svc.createMultipartUpload('a.webm', 'video/webm')).rejects.toThrow();
  });

  it('signs a part URL for the right part number', async () => {
    // Not the stubbed client: getSignedUrl reads the real client's endpoint
    // resolver. Signing is local arithmetic over the credentials, so a real
    // client with fake credentials signs fine and touches no network.
    const svc = new StorageService(config);
    const url = await svc.getUploadPartUrl('a.webm', 'upl-1', 3);
    expect(url).toContain('partNumber=3');
    expect(url).toContain('uploadId=upl-1');
    expect(url).toContain('a.webm');
  });

  it('completes with the parts it is given, in order', async () => {
    const { svc, sent } = serviceWithStub();
    await svc.completeMultipartUpload('a.webm', 'upl-1', [
      { PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' },
    ]);
    expect(sent[0].input).toMatchObject({
      Bucket: 'bucket', Key: 'a.webm', UploadId: 'upl-1',
      MultipartUpload: { Parts: [{ PartNumber: 1, ETag: '"a"' }, { PartNumber: 2, ETag: '"b"' }] },
    });
  });

  it('refuses to complete an upload with no parts', async () => {
    const { svc } = serviceWithStub();
    await expect(svc.completeMultipartUpload('a.webm', 'upl-1', [])).rejects.toThrow();
  });

  it('aborts an upload, which is what stops it billing', async () => {
    const { svc, sent } = serviceWithStub();
    await svc.abortMultipartUpload('a.webm', 'upl-1');
    expect(sent[0].constructor.name).toBe('AbortMultipartUploadCommand');
    expect(sent[0].input).toMatchObject({ Bucket: 'bucket', Key: 'a.webm', UploadId: 'upl-1' });
  });
});
