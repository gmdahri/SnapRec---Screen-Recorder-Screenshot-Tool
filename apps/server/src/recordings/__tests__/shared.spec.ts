import { RecordingsService } from '../recordings.service';

describe('GET /recordings/shared', () => {
  it('sorts by obligation — needs-a-reply first, then by recency', () => {
    const rows = [
      { id: 'a', needsReply: false, lastActivityAt: new Date('2026-08-07') },
      { id: 'b', needsReply: true, lastActivityAt: new Date('2026-08-01') },
      { id: 'c', needsReply: false, lastActivityAt: new Date('2026-08-08') },
    ];
    expect(RecordingsService.sortByObligation(rows).map(r => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps several needs-a-reply rows in recency order among themselves', () => {
    const rows = [
      { id: 'a', needsReply: true, lastActivityAt: new Date('2026-08-01') },
      { id: 'b', needsReply: true, lastActivityAt: new Date('2026-08-05') },
    ];
    expect(RecordingsService.sortByObligation(rows).map(r => r.id)).toEqual(['b', 'a']);
  });

  it('reports a turned-off link as off, not as absent', () => {
    expect(RecordingsService.visibilityOf({ isPublic: false, sharingDisabledAt: new Date() })).toBe('off');
    expect(RecordingsService.visibilityOf({ isPublic: false, sharingDisabledAt: null })).toBe('restricted');
    expect(RecordingsService.visibilityOf({ isPublic: true, sharingDisabledAt: null })).toBe('link');
  });

  it('treats a recording with no visibility columns as link-visible', () => {
    // The schema has no isPublic/sharingDisabledAt yet, and every uploaded
    // recording today is reachable by anyone holding the link. Reporting
    // 'restricted' would be a lie.
    expect(RecordingsService.visibilityOf({})).toBe('link');
  });

  it('marks a capture whose newest comment is not the owner as needing a reply', () => {
    const owner = 'sb-owner';
    expect(RecordingsService.needsReply({
      comments: [
        { createdAt: new Date('2026-08-02'), user: { supabaseId: 'sb-other' } },
      ],
    }, owner)).toBe(true);
  });

  it('does not mark a capture the owner answered last', () => {
    const owner = 'sb-owner';
    expect(RecordingsService.needsReply({
      comments: [
        { createdAt: new Date('2026-08-02'), user: { supabaseId: 'sb-other' } },
        { createdAt: new Date('2026-08-03'), user: { supabaseId: owner } },
      ],
    }, owner)).toBe(false);
  });

  it('does not mark a capture with no comments', () => {
    expect(RecordingsService.needsReply({ comments: [] }, 'sb-owner')).toBe(false);
  });
});
