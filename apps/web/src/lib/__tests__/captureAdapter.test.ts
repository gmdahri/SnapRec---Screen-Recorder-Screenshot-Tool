import { describe, expect, it } from 'vitest';
import { captureHref, needsAttention, toCaptureKind, toCaptureStatus } from '../captureAdapter';

const rec = (over: Record<string, unknown> = {}) => ({
  id: 'r1', title: 'T', fileUrl: 'f', type: 'video' as const,
  createdAt: '2026-08-01T00:00:00Z', views: 0, isReady: true,
  reactions: [], comments: [], ...over,
}) as never;

describe('recording → capture status', () => {
  it('is processing until the file is ready', () => {
    expect(toCaptureStatus(rec({ isReady: false }))).toBe('processing');
  });

  it('is shared once it has viewers or comments — it has been handed out', () => {
    expect(toCaptureStatus(rec({ views: 12 }))).toBe('shared');
    expect(toCaptureStatus(rec({ comments: [{ id: 'c' }] }))).toBe('shared');
  });

  it('is ready when uploaded but never opened by anyone', () => {
    expect(toCaptureStatus(rec())).toBe('ready');
  });

  it('treats a missing isReady as ready rather than stuck processing', () => {
    expect(toCaptureStatus(rec({ isReady: undefined }))).toBe('ready');
  });

  it('maps the two server types onto the capture kinds', () => {
    expect(toCaptureKind(rec({ type: 'video' }))).toBe('recording');
    expect(toCaptureKind(rec({ type: 'screenshot' }))).toBe('screenshot');
  });

  it('flags a capture whose newest comment is not the owner as needing a reply', () => {
    expect(needsAttention(rec({
      user: { supabaseId: 'sb-owner' },
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02', user: { supabaseId: 'sb-other' } }],
    }), 'sb-owner')).toBe(true);
  });

  it('does not flag a capture the owner answered last', () => {
    expect(needsAttention(rec({
      user: { supabaseId: 'sb-owner' },
      comments: [
        { id: 'c1', content: 'q', createdAt: '2026-08-02', user: { supabaseId: 'sb-other' } },
        { id: 'c2', content: 'a', createdAt: '2026-08-03', user: { supabaseId: 'sb-owner' } },
      ],
    }), 'sb-owner')).toBe(false);
  });

  it('does not flag a capture with no comments', () => {
    expect(needsAttention(rec(), 'sb-owner')).toBe(false);
  });

  /** `GET /recordings` returns rows with no `comments`/`reactions` key at all —
   * the list query loads no relations, unlike `findOne`. The `Recording` type
   * declares both as required arrays, so nothing in TypeScript catches it and
   * every helper here dereferences `.length` straight onto undefined. */
  describe('rows from the list endpoint, which carries no relations', () => {
    const bare = () => rec({ comments: undefined, reactions: undefined });

    it('does not crash deriving status without a comments array', () => {
      expect(() => toCaptureStatus(bare())).not.toThrow();
    });

    it('still reports a viewed capture as shared without a comments array', () => {
      expect(toCaptureStatus(rec({ comments: undefined, views: 3 }))).toBe('shared');
    });

    it('does not crash deciding attention without a comments array', () => {
      expect(() => needsAttention(bare(), 'sb-owner')).not.toThrow();
      expect(needsAttention(bare(), 'sb-owner')).toBe(false);
    });
  });
});

/** A screenshot's home is the annotation editor, which loads it by id; a
 * recording's is the viewer. The two browse grids share this so the same
 * thumbnail cannot open in two different places depending on the page. */
describe('where opening a capture lands', () => {
  it('opens a screenshot in the image editor', () => {
    expect(captureHref('screenshot', 'abc123')).toBe('/editor/abc123');
  });

  it('opens a recording in the viewer', () => {
    expect(captureHref('recording', 'abc123')).toBe('/v/abc123');
  });

  it('agrees with the kind the adapter derives from a server row', () => {
    const shot = rec({ id: 's1', type: 'screenshot' });
    const vid = rec({ id: 'v1', type: 'video' });
    expect(captureHref(toCaptureKind(shot), 's1')).toBe('/editor/s1');
    expect(captureHref(toCaptureKind(vid), 'v1')).toBe('/v/v1');
  });
});
