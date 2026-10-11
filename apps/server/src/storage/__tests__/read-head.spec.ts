import { StorageService } from '../storage.service';

/** readHead: the first bytes of an object and its stored Content-Type, from
 * one ranged GET — so checking a multi-GB recording's header never downloads
 * the recording. */

const config = {
  get: (k: string) => ({
    R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET_NAME: 'bucket',
  } as Record<string, string>)[k],
} as any;

function serviceAnswering(answer: (cmd: any) => any) {
  const sent: any[] = [];
  const svc = new StorageService(config);
  (svc as any).s3Client = { send: async (cmd: any) => { sent.push(cmd); return answer(cmd); } };
  return { svc, sent };
}

const body = (bytes: number[]) => ({ transformToByteArray: async () => new Uint8Array(bytes) });

describe('StorageService.readHead', () => {
  it('asks for exactly the first N bytes of the key', async () => {
    const { svc, sent } = serviceAnswering(() => ({ ContentType: 'video/webm', Body: body([0x1a, 0x45, 0xdf, 0xa3]) }));
    await svc.readHead('video-x.webm', 4);
    expect(sent).toHaveLength(1);
    expect(sent[0].constructor.name).toBe('GetObjectCommand');
    expect(sent[0].input).toEqual({ Bucket: 'bucket', Key: 'video-x.webm', Range: 'bytes=0-3' });
  });

  it('returns the bytes and the stored content type', async () => {
    const { svc } = serviceAnswering(() => ({ ContentType: 'video/webm', Body: body([0x1a, 0x45, 0xdf, 0xa3]) }));
    const head = await svc.readHead('video-x.webm', 4);
    expect(head.contentType).toBe('video/webm');
    expect(Buffer.from(head.bytes).toString('hex')).toBe('1a45dfa3');
  });

  it('never returns more than asked, even if R2 ignores the range', async () => {
    const { svc } = serviceAnswering(() => ({ ContentType: 'video/webm', Body: body([1, 2, 3, 4, 5, 6, 7, 8]) }));
    expect((await svc.readHead('video-x.webm', 4)).bytes).toHaveLength(4);
  });

  it('a body-less answer is no bytes, not an error', async () => {
    const { svc } = serviceAnswering(() => ({ ContentType: 'video/webm' }));
    expect((await svc.readHead('video-x.webm', 4)).bytes).toHaveLength(0);
  });

  it('R2 errors reach the caller', async () => {
    const { svc } = serviceAnswering(() => { throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' }); });
    await expect(svc.readHead('video-x.webm', 4)).rejects.toThrow('NoSuchKey');
  });
});
