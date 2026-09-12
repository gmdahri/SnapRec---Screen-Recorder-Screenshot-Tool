import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PART_MIN_BYTES, completionPayload, createUploadState, isUsable, partSliceLength,
  recordPart, shouldFlush, takePartNumber,
} from '../background/upload-parts.core.js';

/** The bookkeeping a multipart upload is made of.
 *
 * R2 rejects a completion whose parts are out of order or whose non-final
 * parts are under 5 MB, and it does so at the very end — after the whole
 * recording has been uploaded. A mistake here is therefore not visible until
 * the most expensive possible moment, which is why the rules live in one
 * tested place rather than inline in the uploader. */

describe('shouldFlush', () => {
  it('holds a buffer below the minimum part size', () => {
    expect(shouldFlush(PART_MIN_BYTES - 1, false)).toBe(false);
  });

  it('flushes once the minimum is reached', () => {
    expect(shouldFlush(PART_MIN_BYTES, false)).toBe(true);
  });

  it('flushes a short final part, which is the one R2 allows', () => {
    expect(shouldFlush(1024, true)).toBe(true);
  });

  it('does not flush an empty final buffer — there is nothing to send', () => {
    expect(shouldFlush(0, true)).toBe(false);
  });
});

describe('part numbering', () => {
  it('is one-based, because R2 rejects part 0', () => {
    const s = createUploadState();
    expect(takePartNumber(s)).toBe(1);
  });

  it('never reuses a number', () => {
    const s = createUploadState();
    expect([takePartNumber(s), takePartNumber(s), takePartNumber(s)]).toEqual([1, 2, 3]);
  });
});

describe('completionPayload', () => {
  it('is empty for an upload that sent nothing', () => {
    expect(completionPayload(createUploadState())).toEqual([]);
  });

  it('uses the exact key names R2 expects', () => {
    const s = createUploadState();
    recordPart(s, { partNumber: 1, etag: '"abc"' });
    expect(completionPayload(s)).toEqual([{ PartNumber: 1, ETag: '"abc"' }]);
  });

  it('sorts ascending even when parts complete out of order', () => {
    // Uploads run concurrently, so a later part can finish first.
    const s = createUploadState();
    recordPart(s, { partNumber: 3, etag: '"c"' });
    recordPart(s, { partNumber: 1, etag: '"a"' });
    recordPart(s, { partNumber: 2, etag: '"b"' });
    expect(completionPayload(s).map((p) => p.PartNumber)).toEqual([1, 2, 3]);
  });

  it('keeps a re-uploaded part once, with the newest ETag', () => {
    // A retried part gets a fresh ETag; sending both would fail completion.
    const s = createUploadState();
    recordPart(s, { partNumber: 2, etag: '"old"' });
    recordPart(s, { partNumber: 2, etag: '"new"' });
    expect(completionPayload(s)).toEqual([{ PartNumber: 2, ETag: '"new"' }]);
  });
});

describe('isUsable', () => {
  it('is false before any part is accepted', () => {
    expect(isUsable(createUploadState())).toBe(false);
  });

  it('is true once a part is in', () => {
    const s = createUploadState();
    recordPart(s, { partNumber: 1, etag: '"a"' });
    expect(isUsable(s)).toBe(true);
  });
});

describe('partSliceLength', () => {
  /** R2 is stricter than S3 here, and only says so at the very end.
   *
   * S3 asks that non-final parts be at least 5 MB. R2 additionally requires
   * every non-trailing part to be EXACTLY the same length, and reports a
   * violation as InvalidPart at CompleteMultipartUpload — after the whole
   * recording has been uploaded. Flushing "whatever has accumulated" therefore
   * produces parts of 5 MB plus a bit, all different, and fails at the one
   * moment that wastes the most work. */

  it('takes nothing while the buffer is short', () => {
    expect(partSliceLength(PART_MIN_BYTES - 1, false)).toBe(0);
  });

  it('takes exactly one part when the buffer just reaches the size', () => {
    expect(partSliceLength(PART_MIN_BYTES, false)).toBe(PART_MIN_BYTES);
  });

  it('takes exactly one part and leaves the remainder buffered', () => {
    // The whole point: NOT PART_MIN_BYTES + 1234.
    expect(partSliceLength(PART_MIN_BYTES + 1234, false)).toBe(PART_MIN_BYTES);
  });

  it('still takes exactly one part when several have accumulated', () => {
    expect(partSliceLength(PART_MIN_BYTES * 3 + 99, false)).toBe(PART_MIN_BYTES);
  });

  it('takes everything left for the trailing part, whatever its size', () => {
    expect(partSliceLength(1234, true)).toBe(1234);
    expect(partSliceLength(PART_MIN_BYTES * 2 + 7, true)).toBe(PART_MIN_BYTES * 2 + 7);
  });

  it('takes nothing from an empty final buffer', () => {
    expect(partSliceLength(0, true)).toBe(0);
  });
});

describe('the classic-script copy', () => {
  it('has not drifted from the tested module', () => {
    // Order matters: strip the whole `export { ... };` block BEFORE stripping
    // a leading `export ` keyword, or the first rule eats the keyword and
    // leaves an orphaned brace list behind.
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecParts[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/upload-parts.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/upload-parts.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
