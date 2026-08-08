import { describe, expect, it } from 'vitest';
import { toShareComments, toShareState } from '../toShareProps';

const rec = (over: Record<string, unknown> = {}) => ({
  id: 'r1', title: 'T', fileUrl: 'f', type: 'video' as const,
  createdAt: '2026-08-01T00:00:00Z', views: 0, isReady: true,
  reactions: [], comments: [], ...over,
}) as never;

describe('share state', () => {
  it('is processing until the file is ready', () => {
    expect(toShareState(rec({ isReady: false }))).toBe('processing');
  });

  it('is ready once the file is', () => {
    expect(toShareState(rec())).toBe('ready');
  });

  it('is private when the owner turned the link off', () => {
    expect(toShareState(rec({ sharingDisabledAt: '2026-08-02T00:00:00Z' }))).toBe('private');
  });

  it('is private when the recording was never public', () => {
    expect(toShareState(rec({ isPublic: false }))).toBe('private');
  });

  it('treats an absent isPublic as public — that is what every old row is', () => {
    expect(toShareState(rec({ isPublic: undefined }))).toBe('ready');
  });
});

describe('share comments', () => {
  it('reads a timecode anchor from the server', () => {
    const [c] = toShareComments(rec({
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02', timecodeMs: 11_000 }],
    }), undefined);
    expect(c.anchor).toEqual({ kind: 'timecode', ms: 11_000 });
  });

  it('reads a point anchor from the server', () => {
    const [c] = toShareComments(rec({
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02', anchorX: 0.3, anchorY: 0.4 }],
    }), undefined);
    expect(c.anchor).toEqual({ kind: 'point', x: 0.3, y: 0.4 });
  });

  it('falls back to a zero timecode when a comment has no anchor', () => {
    // Every comment written before the anchor columns existed. Rendering them
    // at 0:00 keeps them visible rather than dropping them off the timeline.
    const [c] = toShareComments(rec({
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02' }],
    }), undefined);
    expect(c.anchor).toEqual({ kind: 'timecode', ms: 0 });
  });

  it('numbers comments in chronological order', () => {
    const list = toShareComments(rec({
      comments: [
        { id: 'b', content: 'second', createdAt: '2026-08-03' },
        { id: 'a', content: 'first', createdAt: '2026-08-02' },
      ],
    }), undefined);
    expect(list.map(c => c.index)).toEqual([1, 2]);
    expect(list[0].body).toBe('first');
  });

  it('marks only the newest non-owner comment as needing a reply', () => {
    const list = toShareComments(rec({
      user: { supabaseId: 'owner' },
      comments: [
        { id: 'a', content: 'q', createdAt: '2026-08-02', user: { supabaseId: 'other' } },
        { id: 'b', content: 'q2', createdAt: '2026-08-03', user: { supabaseId: 'other' } },
      ],
    }), 'owner');
    expect(list.map(c => c.needsReply)).toEqual([false, true]);
  });

  it('marks nothing when the owner replied last', () => {
    const list = toShareComments(rec({
      user: { supabaseId: 'owner' },
      comments: [
        { id: 'a', content: 'q', createdAt: '2026-08-02', user: { supabaseId: 'other' } },
        { id: 'b', content: 'a', createdAt: '2026-08-03', user: { supabaseId: 'owner' } },
      ],
    }), 'owner');
    expect(list.every(c => !c.needsReply)).toBe(true);
  });
});
