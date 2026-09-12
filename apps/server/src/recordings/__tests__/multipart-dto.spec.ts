import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  BeginUploadDto, PartUrlDto, CompleteUploadDto, AbortUploadDto,
} from '../dto/multipart.dto';

/** The global ValidationPipe runs with whitelist + forbidNonWhitelisted, so
 * these DTOs are the API surface, not a formality — an unlisted field is a
 * 400. The part list is the one worth care: R2 accepts it only at the very
 * end of an upload, so a malformed list fails after the whole recording has
 * already been sent. */

const of = <T>(cls: new () => T, o: Record<string, unknown>) => plainToInstance(cls, o);

describe('begin upload', () => {
  it('accepts a file name and content type', async () => {
    expect(await validate(of(BeginUploadDto, { fileName: 'a.webm', contentType: 'video/webm' })))
      .toHaveLength(0);
  });

  it('rejects a missing file name', async () => {
    expect(await validate(of(BeginUploadDto, { contentType: 'video/webm' }))).not.toHaveLength(0);
  });
});

describe('part url', () => {
  const ok = { fileName: 'a.webm', uploadId: 'upl-1', partNumber: 1 };

  it('accepts a one-based part number', async () => {
    expect(await validate(of(PartUrlDto, ok))).toHaveLength(0);
  });

  it('rejects part number 0, which R2 does not allow', async () => {
    expect(await validate(of(PartUrlDto, { ...ok, partNumber: 0 }))).not.toHaveLength(0);
  });

  it('rejects a part number past R2 limit of 10000', async () => {
    expect(await validate(of(PartUrlDto, { ...ok, partNumber: 10001 }))).not.toHaveLength(0);
  });
});

describe('complete upload', () => {
  const parts = [{ PartNumber: 1, ETag: '"a"' }];

  it('accepts a well-formed part list', async () => {
    expect(await validate(of(CompleteUploadDto, { fileName: 'a.webm', uploadId: 'u', parts })))
      .toHaveLength(0);
  });

  it('rejects an empty part list', async () => {
    expect(await validate(of(CompleteUploadDto, { fileName: 'a.webm', uploadId: 'u', parts: [] })))
      .not.toHaveLength(0);
  });

  it('rejects a part with no ETag', async () => {
    expect(await validate(of(CompleteUploadDto, {
      fileName: 'a.webm', uploadId: 'u', parts: [{ PartNumber: 1 }],
    }))).not.toHaveLength(0);
  });
});

describe('abort upload', () => {
  it('accepts a file name and upload id', async () => {
    expect(await validate(of(AbortUploadDto, { fileName: 'a.webm', uploadId: 'u' })))
      .toHaveLength(0);
  });

  it('rejects a missing upload id — there would be nothing to abort', async () => {
    expect(await validate(of(AbortUploadDto, { fileName: 'a.webm' }))).not.toHaveLength(0);
  });
});
