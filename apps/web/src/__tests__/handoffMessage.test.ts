import { describe, expect, it } from 'vitest';
import { readHandoffMessage, trustedExtensionOrigins } from '../lib/handoffMessage';

/** The gate every capture passes through on its way into the share view.
 *
 * Two things are being defended at once and they pull in opposite directions.
 * Extensions update over days, so the legacy shape — posted from the page's
 * own main world by an injected script — has to keep working or every user
 * who has not updated loses their recording. But the handler used to accept
 * SNAPREC_VIDEO_DATA from any origin at all, which let any cross-origin frame
 * on the page put a video in front of the user. Accept both shapes; accept
 * neither from a stranger. */

const SELF = 'https://www.snaprecorder.org';
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

describe('readHandoffMessage', () => {
  it('accepts a Blob from the extension iframe', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1' }, SELF))
      .toEqual({ kind: 'blob', blob, id: 'r1', metadataStr: undefined });
  });

  it('carries click metadata through to the video editor', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1', metadataStr: '[{"t":1,"x":2}]',
    }, SELF);
    expect(got).toEqual({ kind: 'blob', blob, id: 'r1', metadataStr: '[{"t":1,"x":2}]' });
  });

  it('still accepts a capture whose metadata is not a string', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, metadataStr: { nope: true },
    }, SELF);
    expect(got?.kind).toBe('blob');
    expect((got as { metadataStr?: string }).metadataStr).toBeUndefined();
  });

  it('accepts the legacy same-origin IDB signal from older extensions', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_VIDEO_DATA', fromIDB: true, id: 'r1' }, SELF))
      .toEqual({ kind: 'idb', id: 'r1' });
  });

  it('accepts the legacy data URL shape', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_VIDEO_DATA', dataUrl: 'data:video/webm;base64,AA' }, SELF))
      .toEqual({ kind: 'dataUrl', dataUrl: 'data:video/webm;base64,AA', id: undefined });
  });

  it('rejects a capture from a cross-origin frame', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage('https://evil.example', { type: 'SNAPREC_VIDEO_DATA', blob }, SELF))
      .toBeNull();
  });

  it('rejects a look-alike origin that merely starts with the real one', () => {
    expect(readHandoffMessage(
      'https://www.snaprecorder.org.evil.example',
      { type: 'SNAPREC_VIDEO_DATA', fromIDB: true },
      SELF,
    )).toBeNull();
  });

  it('ignores messages that are not ours', () => {
    expect(readHandoffMessage(EXT, { type: 'SOMETHING_ELSE', fromIDB: true }, SELF)).toBeNull();
  });

  it('ignores a correctly-typed message carrying no capture', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', id: 'r1' }, SELF)).toBeNull();
  });

  it('prefers the Blob when a message somehow carries both', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, fromIDB: true, id: 'r1',
    }, SELF);
    expect(got?.kind).toBe('blob');
  });

  it('survives junk', () => {
    expect(readHandoffMessage(EXT, null, SELF)).toBeNull();
    expect(readHandoffMessage(EXT, 'string', SELF)).toBeNull();
    expect(readHandoffMessage(EXT, 42, SELF)).toBeNull();
  });

  it('drops a non-string id rather than passing it on', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob, id: 99 }, SELF))
      .toEqual({ kind: 'blob', blob, id: undefined, metadataStr: undefined });
  });
});

describe('readHandoffMessage — screenshots', () => {
  it('accepts an image Blob from the extension iframe', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_EDIT_IMAGE', blob, id: 'i1' }, SELF))
      .toEqual({ kind: 'image', blob, id: 'i1' });
  });

  it('accepts the legacy data URL an older extension injects', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_EDIT_IMAGE', dataUrl: 'data:image/png;base64,AA' }, SELF))
      .toEqual({ kind: 'imageDataUrl', dataUrl: 'data:image/png;base64,AA', id: undefined });
  });

  it('rejects an image from a cross-origin frame', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    expect(readHandoffMessage('https://evil.example', { type: 'SNAPREC_EDIT_IMAGE', blob }, SELF))
      .toBeNull();
  });

  it('ignores an image message carrying nothing', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_EDIT_IMAGE', id: 'i1' }, SELF)).toBeNull();
  });

  it('keeps video and image messages distinct', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob }, SELF)?.kind).toBe('blob');
  });
});

describe('in a production build: only SnapRec\'s own extension', () => {
  const STORE = 'chrome-extension://lgafjgnifbjeafallnkkfpljgbilfajg';
  const prod = trustedExtensionOrigins({ DEV: false, VITE_EXTENSION_ID: 'lgafjgnifbjeafallnkkfpljgbilfajg' });
  const blob = new Blob(['x']);

  it('accepts the store extension', () => {
    expect(readHandoffMessage(STORE, { type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1' }, SELF, prod))
      .toMatchObject({ kind: 'blob', id: 'r1' });
  });

  it('refuses any other extension, with every message type', () => {
    for (const data of [
      { type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1' },
      { type: 'SNAPREC_HANDOFF_PENDING', id: 'r1' },
      { type: 'SNAPREC_UPLOAD_PROGRESS', id: 'r1', state: 'registered' },
      { type: 'SNAPREC_LOCAL_SAVE', id: 'r1', ok: true },
    ]) expect(readHandoffMessage(EXT, data, SELF, prod)).toBeNull();
  });

  it('accepts extra ids listed for testing an unpacked build', () => {
    const withDev = trustedExtensionOrigins({ DEV: false, VITE_EXTENSION_IDS: 'abcdefghijklmnopabcdefghijklmnop, not-an-id' });
    expect(withDev?.has(EXT)).toBe(true);
    expect(withDev?.has(STORE)).toBe(true);
    expect(withDev?.size).toBe(2);
  });

  it('a development build accepts any extension', () => {
    expect(trustedExtensionOrigins({ DEV: true })).toBeNull();
  });
});

describe('the courier\'s status messages', () => {
  it('reads upload progress, keeping only well-formed numbers and a short reason', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_UPLOAD_PROGRESS', id: 'r1', state: 'uploading', uploadedBytes: 5, totalBytes: 'ten', reason: 'x'.repeat(200) }, SELF))
      .toEqual({ kind: 'progress', id: 'r1', state: 'uploading', uploadedBytes: 5, totalBytes: undefined, reason: 'x'.repeat(40) });
  });

  it('refuses an unknown upload state', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_UPLOAD_PROGRESS', id: 'r1', state: 'pwned' }, SELF)).toBeNull();
  });

  it('reads "still coming" and the save result', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_HANDOFF_PENDING', id: 'r1' }, SELF)).toEqual({ kind: 'pending', id: 'r1' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_LOCAL_SAVE', id: 'r1', ok: false }, SELF)).toEqual({ kind: 'localSave', id: 'r1', ok: false });
  });

  it('never takes them from the page itself', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_UPLOAD_PROGRESS', id: 'r1', state: 'registered' }, SELF)).toBeNull();
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_HANDOFF_PENDING', id: 'r1' }, SELF)).toBeNull();
  });
});
