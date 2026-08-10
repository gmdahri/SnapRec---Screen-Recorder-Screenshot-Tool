import { RecordingsController } from '../recordings.controller';
import { AddCommentDto } from '../dto';

/** The link that was broken.
 *
 * Everything either side of the controller was in place and tested — the DTO
 * validated the anchor, the columns existed, the migration had run, and the
 * viewer knew how to draw a timecode. The controller simply did not pass the
 * anchor to the service, so it went no further than request validation.
 *
 * A pass-through is exactly the kind of code that looks too trivial to test and
 * is why this shipped: the failure is silent, and every layer around it is
 * green. */

const dto = (o: Partial<AddCommentDto>): AddCommentDto =>
  Object.assign(new AddCommentDto(), { content: 'a comment', ...o });

function makeController() {
  const recordings = { addComment: jest.fn().mockResolvedValue({ id: 'com-1' }) };
  const controller = new RecordingsController({} as any, recordings as any);
  return { controller, recordings };
}

/** The anchor is the sixth argument. */
const anchorArg = (mock: jest.Mock) => mock.mock.calls[0][5];

describe('POST /recordings/:id/comments', () => {
  it('forwards the timecode a video comment was pinned to', async () => {
    const { controller, recordings } = makeController();
    await controller.addComment('rec-1', dto({ timecodeMs: 10_000 }), { user: { id: 'sb-1' } });
    expect(anchorArg(recordings.addComment)).toMatchObject({ timecodeMs: 10_000 });
  });

  it('forwards a point anchor on a screenshot', async () => {
    const { controller, recordings } = makeController();
    await controller.addComment('rec-1', dto({ anchorX: 0.25, anchorY: 0.5 }), { user: { id: 'sb-1' } });
    expect(anchorArg(recordings.addComment)).toMatchObject({ anchorX: 0.25, anchorY: 0.5 });
  });

  it('forwards 0 as a real moment', async () => {
    const { controller, recordings } = makeController();
    await controller.addComment('rec-1', dto({ timecodeMs: 0 }), { user: { id: 'sb-1' } });
    expect(anchorArg(recordings.addComment)).toMatchObject({ timecodeMs: 0 });
  });

  it('still forwards the identity and the content alongside it', async () => {
    const { controller, recordings } = makeController();
    await controller.addComment(
      'rec-1',
      dto({ content: 'Rounding looks off', guestId: 'g-1', timecodeMs: 7_500 }),
      { user: { id: 'sb-1', email: 'a@b.co', fullName: 'A B' } },
    );
    const [id, content, userId, guestId, userMeta] = recordings.addComment.mock.calls[0];
    expect({ id, content, userId, guestId }).toEqual({
      id: 'rec-1', content: 'Rounding looks off', userId: 'sb-1', guestId: 'g-1',
    });
    expect(userMeta).toMatchObject({ email: 'a@b.co', fullName: 'A B' });
  });

  it('passes an anchor object even when the comment has none, not a stray undefined', async () => {
    const { controller, recordings } = makeController();
    await controller.addComment('rec-1', dto({}), { user: { id: 'sb-1' } });
    expect(anchorArg(recordings.addComment)).toEqual({
      timecodeMs: undefined, anchorX: undefined, anchorY: undefined,
    });
  });
});
