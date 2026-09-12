import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  downloadSettled, downloadStarted, recordingFilename,
} from '../background/recording-file.core.js';

/** The disk copy is the product's only guarantee that a recording survives.
 *
 * These tests exist because both of its failure modes are silent:
 * chrome.downloads reports a refusal by setting lastError and returning an
 * undefined id, and reports a mid-write failure only through an onChanged
 * delta that arrives long after the call returned. Neither surfaces unless
 * you ask, which is how a capture used to vanish with nothing logged. */
describe('disk copy naming', () => {
  it('files the capture under a SnapRec folder so there is somewhere to look', () => {
    const name = recordingFilename(new Date(2026, 8, 13, 14, 5, 9), 'video/webm');
    expect(name.startsWith('SnapRec/')).toBe(true);
  });

  it('zero-pads every field so names sort chronologically', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'video/webm'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.webm');
  });

  it('follows the recorder rather than assuming webm', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'video/mp4;codecs=avc1'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.mp4');
  });

  it('treats an unrecognised mime type as webm, the recorder default', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), '')).toMatch(/\.webm$/);
  });

  it('names a WebP screenshot with a webp extension', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'image/webp'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.webp');
  });

  it('names a PNG screenshot with a png extension', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'image/png'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.png');
  });

  it('still treats an unrecognised type as webm, the recorder default', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'application/octet-stream'))
      .toMatch(/\.webm$/);
  });
});

describe('reading the start of a download', () => {
  it('accepts a real download id', () => {
    expect(downloadStarted(42, undefined)).toEqual({ ok: true, downloadId: 42 });
  });

  it('reports lastError in preference to anything else', () => {
    expect(downloadStarted(42, 'Download interrupted')).toEqual({
      ok: false, reason: 'Download interrupted',
    });
  });

  it('treats an undefined id as a refusal, not a success', () => {
    expect(downloadStarted(undefined, undefined)).toEqual({
      ok: false, reason: 'download did not start',
    });
  });

  it('does not mistake download id 0 for a missing id', () => {
    expect(downloadStarted(0, undefined)).toEqual({ ok: true, downloadId: 0 });
  });
});

describe('reading the end of a download', () => {
  it('stays silent until the download actually settles', () => {
    expect(downloadSettled({ id: 7, bytesReceived: { current: 1024 } }, 7)).toBeNull();
  });

  it('ignores deltas belonging to some other download', () => {
    expect(downloadSettled({ id: 8, state: { current: 'complete' } }, 7)).toBeNull();
  });

  it('reports completion', () => {
    expect(downloadSettled({ id: 7, state: { current: 'complete' } }, 7)).toEqual({ ok: true });
  });

  it('reports the interruption reason when Chrome gives one', () => {
    expect(downloadSettled(
      { id: 7, state: { current: 'interrupted' }, error: { current: 'DISK_FULL' } }, 7,
    )).toEqual({ ok: false, reason: 'DISK_FULL' });
  });

  it('still reports an interruption that carries no reason', () => {
    expect(downloadSettled({ id: 7, state: { current: 'interrupted' } }, 7)).toEqual({
      ok: false, reason: 'interrupted',
    });
  });

  it('tolerates a null delta', () => {
    expect(downloadSettled(null, 7)).toBeNull();
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
      .replace(/globalThis\.SnapRecFile[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/recording-file.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/recording-file.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
