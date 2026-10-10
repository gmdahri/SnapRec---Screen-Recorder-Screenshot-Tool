import { describe, expect, it } from 'vitest';
import { localUploadCreateInput } from '../localUpload';

describe('the body for uploading the capture on this device', () => {
  it('sends no id, so it can never collide with the row the extension registered', () => {
    const body = localUploadCreateInput({ fileUrl: 'video-x.webm', userId: 'sb-1', meta: { durationSec: 12 } });
    expect(body).not.toHaveProperty('id');
  });

  it('names the signed-in user and carries the measured media', () => {
    const body = localUploadCreateInput({
      fileUrl: 'video-x.webm', userId: 'sb-1', meta: { durationSec: 12, widthPx: 1920, heightPx: 1080 },
    });
    expect(body).toMatchObject({
      fileUrl: 'video-x.webm', type: 'video', userId: 'sb-1', durationSec: 12, widthPx: 1920, heightPx: 1080,
    });
  });
});
