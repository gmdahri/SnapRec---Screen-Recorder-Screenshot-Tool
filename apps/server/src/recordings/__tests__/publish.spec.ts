import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordingsService } from '../recordings.service';

/** P7 E6 — publishing over an existing recording.
 *
 * This is the one operation in the product that destroys something: the media
 * at a live share link is replaced and the previous file is no longer reachable
 * at that id. The tests below are mostly about what must NOT change. */

const OWNER = 'sb-owner';
const STRANGER = 'sb-stranger';
const ID = 'rec-1';

function makeService(over: { owner?: string | null; comments?: any[]; durationSec?: number } = {}) {
  const recording: any = {
    id: ID,
    fileUrl: 'old.webm',
    durationSec: over.durationSec ?? 180,
    views: 42,
    title: 'Original title',
    user: over.owner === null ? null : { supabaseId: over.owner ?? OWNER },
    comments: over.comments ?? [],
  };
  const recordings = {
    findOne: jest.fn().mockResolvedValue(recording),
    save: jest.fn().mockImplementation(async (r: unknown) => r),
  };
  const service = new RecordingsService(
    recordings as any, {} as any, {} as any, {} as any,
    { findOrCreateBySupabaseId: jest.fn() } as any,
  );
  return { service, recordings, recording };
}

describe('publishing over a recording', () => {
  it('replaces the media', async () => {
    const { service } = makeService();
    const { recording } = await service.publish(ID, { fileUrl: 'new.webm' }, OWNER);
    expect(recording.fileUrl).toBe('new.webm');
  });

  it('records the new length', async () => {
    const { service } = makeService();
    const { recording } = await service.publish(ID, { fileUrl: 'new.webm', durationSec: 91 }, OWNER);
    expect(recording.durationSec).toBe(91);
  });

  /** The promise the editor makes before doing this. */
  it('keeps the id, the view count and the title', async () => {
    const { service } = makeService();
    const { recording } = await service.publish(ID, { fileUrl: 'new.webm', durationSec: 91 }, OWNER);
    expect(recording.id).toBe(ID);
    expect(recording.views).toBe(42);
    expect(recording.title).toBe('Original title');
  });

  it('leaves the length alone when the publisher does not know it', async () => {
    const { service } = makeService({ durationSec: 180 });
    const { recording } = await service.publish(ID, { fileUrl: 'new.webm' }, OWNER);
    expect(recording.durationSec).toBe(180);
  });
});

describe('who may publish', () => {
  it('refuses anyone but the owner', async () => {
    const { service } = makeService();
    await expect(service.publish(ID, { fileUrl: 'new.webm' }, STRANGER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  /** A guest capture has no owner row, so nobody can publish over it until it
   * is claimed — better than letting any signed-in user overwrite it. */
  it('refuses when the capture has no owner', async () => {
    const { service } = makeService({ owner: null });
    await expect(service.publish(ID, { fileUrl: 'new.webm' }, OWNER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports a recording that does not exist', async () => {
    const { service, recordings } = makeService();
    recordings.findOne.mockResolvedValue(null);
    await expect(service.publish(ID, { fileUrl: 'new.webm' }, OWNER))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('comments left pointing past the new end', () => {
  const comments = [
    { id: 'a', timecodeMs: 30_000 },
    { id: 'b', timecodeMs: 160_000 },
    { id: 'c', timecodeMs: 175_000 },
    { id: 'd', timecodeMs: null },
  ];

  /** Deleting them would destroy something a person wrote; leaving them
   * unreported would let the editor publish without saying what it broke. */
  it('counts them rather than deleting them', async () => {
    const { service } = makeService({ comments });
    const { staleComments } = await service.publish(
      ID, { fileUrl: 'new.webm', durationSec: 91 }, OWNER,
    );
    expect(staleComments).toBe(2);
  });

  it('leaves every comment in place', async () => {
    const { service, recording } = makeService({ comments });
    await service.publish(ID, { fileUrl: 'new.webm', durationSec: 91 }, OWNER);
    expect(recording.comments).toHaveLength(4);
  });

  it('ignores comments with no timecode', async () => {
    const { service } = makeService({ comments: [{ id: 'd', timecodeMs: null }] });
    const { staleComments } = await service.publish(
      ID, { fileUrl: 'new.webm', durationSec: 1 }, OWNER,
    );
    expect(staleComments).toBe(0);
  });

  it('counts none when the edit did not shorten anything', async () => {
    const { service } = makeService({ comments });
    const { staleComments } = await service.publish(
      ID, { fileUrl: 'new.webm', durationSec: 180 }, OWNER,
    );
    expect(staleComments).toBe(0);
  });

  /** Without a known length there is nothing to compare against, and guessing
   * would report every comment as broken. */
  it('claims nothing when the new length is unknown', async () => {
    const { service } = makeService({ comments, durationSec: 0 });
    const { staleComments } = await service.publish(ID, { fileUrl: 'new.webm' }, OWNER);
    expect(staleComments).toBe(0);
  });
});
