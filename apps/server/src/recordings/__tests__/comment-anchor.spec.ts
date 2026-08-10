import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AddCommentDto } from '../dto/add-comment.dto';

const dto = (o: Record<string, unknown>) => plainToInstance(AddCommentDto, o);

describe('comment anchors', () => {
  it('accepts a timecode anchor', async () => {
    expect(await validate(dto({ content: 'hi', timecodeMs: 11_000 }))).toHaveLength(0);
  });

  it('accepts a normalised point anchor', async () => {
    expect(await validate(dto({ content: 'hi', anchorX: 0.25, anchorY: 0.5 }))).toHaveLength(0);
  });

  it('rejects a point outside the image', async () => {
    expect(await validate(dto({ content: 'hi', anchorX: 1.4, anchorY: 0.5 }))).not.toHaveLength(0);
  });

  it('rejects a negative timecode', async () => {
    expect(await validate(dto({ content: 'hi', timecodeMs: -1 }))).not.toHaveLength(0);
  });

  it('accepts a comment with no anchor at all', async () => {
    expect(await validate(dto({ content: 'hi' }))).toHaveLength(0);
  });

  it('still accepts a guestId — this page must work logged out', async () => {
    expect(await validate(dto({ content: 'hi', guestId: 'g-123' }))).toHaveLength(0);
  });
});
