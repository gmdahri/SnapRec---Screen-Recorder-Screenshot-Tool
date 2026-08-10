import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RecordingsService } from '../recordings.service';

/** P7 V3 — who may settle a question, and who may not.
 *
 * Authorisation is the whole point of this endpoint, so it is tested against
 * the service rather than through the DTO: the DTO carries one boolean and
 * proves nothing about who is allowed to send it. */

const OWNER = 'sb-owner';
const AUTHOR = 'sb-author';
const STRANGER = 'sb-stranger';
const RECORDING_ID = 'rec-1';
const COMMENT_ID = 'com-1';

function makeService(over: { recordingOwner?: string | null; commentAuthor?: string | null;
                            recordingId?: string } = {}) {
  const comment: any = {
    id: COMMENT_ID,
    resolvedAt: null,
    resolvedByUserId: null,
    recording: {
      id: over.recordingId ?? RECORDING_ID,
      user: over.recordingOwner === null ? null : { supabaseId: over.recordingOwner ?? OWNER },
    },
    user: over.commentAuthor === null ? null : { supabaseId: over.commentAuthor ?? AUTHOR },
  };

  const comments = {
    findOne: jest.fn().mockResolvedValue(comment),
    save: jest.fn().mockImplementation(async (c: unknown) => c),
  };
  const users = { findOrCreateBySupabaseId: jest.fn().mockResolvedValue({ id: 'user-row-1' }) };

  const service = new RecordingsService(
    {} as any, {} as any, comments as any, {} as any, users as any,
  );
  return { service, comments, users, comment };
}

describe('resolving a comment', () => {
  it('lets the capture owner settle it', async () => {
    const { service } = makeService();
    const saved = await service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, OWNER);
    expect(saved.resolvedAt).toBeInstanceOf(Date);
    expect(saved.resolvedByUserId).toBe('user-row-1');
  });

  /** Closing your own question is the common case; blocking it would be odd. */
  it('lets the comment’s author settle their own question', async () => {
    const { service } = makeService();
    const saved = await service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, AUTHOR);
    expect(saved.resolvedAt).toBeInstanceOf(Date);
  });

  it('refuses anyone else', async () => {
    const { service } = makeService();
    await expect(service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, STRANGER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  /** A guestId is readable by anyone holding the share link, so honouring it
   * would let any recipient close other people's questions. */
  it('refuses an anonymous caller outright', async () => {
    const { service } = makeService();
    await expect(service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, undefined))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  /** Comment ids are globally unique, so without this a valid id could be
   * resolved through a recording its author never commented on. */
  it('refuses a comment that belongs to a different recording', async () => {
    const { service } = makeService({ recordingId: 'some-other-recording' });
    await expect(service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, OWNER))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a comment that does not exist', async () => {
    const { service, comments } = makeService();
    comments.findOne.mockResolvedValue(null);
    await expect(service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, OWNER))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('reopens a settled comment and forgets who settled it', async () => {
    const { service } = makeService();
    const saved = await service.setCommentResolved(RECORDING_ID, COMMENT_ID, false, OWNER);
    expect(saved.resolvedAt).toBeNull();
    expect(saved.resolvedByUserId).toBeNull();
  });

  it('does not mint a user row when merely reopening', async () => {
    const { service, users } = makeService();
    await service.setCommentResolved(RECORDING_ID, COMMENT_ID, false, OWNER);
    expect(users.findOrCreateBySupabaseId).not.toHaveBeenCalled();
  });

  /** A guest's capture has no owner row; the comment author can still settle. */
  it('still lets the author settle on an unclaimed capture', async () => {
    const { service } = makeService({ recordingOwner: null });
    const saved = await service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, AUTHOR);
    expect(saved.resolvedAt).toBeInstanceOf(Date);
  });

  it('refuses when neither side has a signed-in identity', async () => {
    const { service } = makeService({ recordingOwner: null, commentAuthor: null });
    await expect(service.setCommentResolved(RECORDING_ID, COMMENT_ID, true, OWNER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
