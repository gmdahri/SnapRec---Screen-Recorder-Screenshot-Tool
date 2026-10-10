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
    }));
    expect(c.anchor).toEqual({ kind: 'timecode', ms: 11_000 });
  });

  it('reads a point anchor from the server', () => {
    const [c] = toShareComments(rec({
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02', anchorX: 0.3, anchorY: 0.4 }],
    }));
    expect(c.anchor).toEqual({ kind: 'point', x: 0.3, y: 0.4 });
  });

  it('falls back to a zero timecode when a comment has no anchor', () => {
    // Every comment written before the anchor columns existed. Rendering them
    // at 0:00 keeps them visible rather than dropping them off the timeline.
    const [c] = toShareComments(rec({
      comments: [{ id: 'c1', content: 'hi', createdAt: '2026-08-02' }],
    }));
    expect(c.anchor).toEqual({ kind: 'timecode', ms: 0 });
  });

  it('numbers comments in chronological order', () => {
    const list = toShareComments(rec({
      comments: [
        { id: 'b', content: 'second', createdAt: '2026-08-03' },
        { id: 'a', content: 'first', createdAt: '2026-08-02' },
      ],
    }));
    expect(list.map(c => c.index)).toEqual([1, 2]);
    expect(list[0].body).toBe('first');
  });

  it('marks only the newest non-owner comment as needing a reply', () => {
    const list = toShareComments(rec({
      user: { fullName: 'Owner' },
      comments: [
        { id: 'a', content: 'q', createdAt: '2026-08-02', user: { fullName: 'Dana' }, byOwner: false },
        { id: 'b', content: 'q2', createdAt: '2026-08-03', user: { fullName: 'Dana' }, byOwner: false },
      ],
    }));
    expect(list.map(c => c.needsReply)).toEqual([false, true]);
  });

  it('marks nothing when the owner replied last', () => {
    const list = toShareComments(rec({
      user: { fullName: 'Owner' },
      comments: [
        { id: 'a', content: 'q', createdAt: '2026-08-02', user: { fullName: 'Dana' }, byOwner: false },
        { id: 'b', content: 'a', createdAt: '2026-08-03', user: { fullName: 'Owner' }, byOwner: true },
      ],
    }));
    expect(list.every(c => !c.needsReply)).toBe(true);
  });

  it('marks nothing on a guest recording — there is no owner to owe a reply', () => {
    const list = toShareComments(rec({
      user: null,
      comments: [{ id: 'a', content: 'q', createdAt: '2026-08-02', byOwner: false }],
    }));
    expect(list.every(c => !c.needsReply)).toBe(true);
  });
});

/** P7 V3 — resolution now comes from the database rather than being false. */
describe('a settled comment', () => {
  const rec = (comments: unknown[]) => ({
    id: 'r1', title: 'T', fileUrl: 'f', type: 'video', createdAt: '2026-08-01T00:00:00Z',
    views: 0, reactions: [], comments,
    user: { fullName: 'Owner' },
  }) as never;

  const comment = (over: Record<string, unknown> = {}) => ({
    id: 'c1', content: 'q', createdAt: '2026-08-02T00:00:00Z',
    user: { fullName: 'Dana' }, byOwner: false, ...over,
  });

  it('reads as resolved once it has been settled', () => {
    const [out] = toShareComments(rec([comment({ resolvedAt: '2026-08-03T00:00:00Z' })]));
    expect(out.resolved).toBe(true);
  });

  it('reads as open while it has not', () => {
    const [out] = toShareComments(rec([comment()]));
    expect(out.resolved).toBe(false);
  });

  /** Otherwise resolving a question would leave its coral marker burning on
   * the timeline, still claiming a reply is owed. */
  it('stops being owed a reply once settled', () => {
    const open = toShareComments(rec([comment()]));
    expect(open[0].needsReply).toBe(true);

    const settled = toShareComments(rec([comment({ resolvedAt: '2026-08-03T00:00:00Z' })]));
    expect(settled[0].needsReply).toBe(false);
  });
});
