import { NotFoundException } from '@nestjs/common';
import { RecordingsService } from '../recordings.service';

/** The anchor has to reach the row.
 *
 * comment-anchor.spec.ts proves the DTO accepts an anchor. It did — and the
 * service then took no anchor argument at all, so every video comment was saved
 * with a null timecode and the viewer's `timecodeMs ?? 0` fallback drew it at
 * 0:00. A comment pinned at 0:10 reopened at the start of the recording.
 *
 * Validating a field is not storing it. These tests assert the saved row. */

const RECORDING_ID = 'rec-1';

function makeService() {
  const recordings = { findOne: jest.fn().mockResolvedValue({ id: RECORDING_ID }) };
  const comments = { save: jest.fn().mockImplementation(async (c: unknown) => c) };
  const users = { findOrCreateBySupabaseId: jest.fn().mockResolvedValue({ id: 'user-row-1' }) };

  const service = new RecordingsService(
    recordings as any, {} as any, comments as any, {} as any, users as any,
  );
  return { service, recordings, comments, users };
}

describe('storing a comment anchor', () => {
  it('keeps the moment a video comment was pinned to', async () => {
    const { service } = makeService();
    const saved = await service.addComment(
      RECORDING_ID, 'Rounding looks off', 'sb-1', undefined, undefined, { timecodeMs: 10_000 },
    );
    expect(saved.timecodeMs).toBe(10_000);
  });

  it('keeps a normalised point on a screenshot', async () => {
    const { service } = makeService();
    const saved = await service.addComment(
      RECORDING_ID, 'Column 3', 'sb-1', undefined, undefined, { anchorX: 0.25, anchorY: 0.5 },
    );
    expect(saved.anchorX).toBe(0.25);
    expect(saved.anchorY).toBe(0.5);
  });

  /** 0:00 is a real moment — the first frame — and must not be mistaken for
   * "no anchor", which is exactly what `||` would do here. */
  it('treats a comment pinned at zero as pinned, not as unanchored', async () => {
    const { service } = makeService();
    const saved = await service.addComment(
      RECORDING_ID, 'Title card is wrong', 'sb-1', undefined, undefined, { timecodeMs: 0 },
    );
    expect(saved.timecodeMs).toBe(0);
  });

  it('stores nulls for a comment about the capture as a whole', async () => {
    const { service } = makeService();
    const saved = await service.addComment(RECORDING_ID, 'Nice work', 'sb-1');
    expect(saved.timecodeMs).toBeNull();
    expect(saved.anchorX).toBeNull();
    expect(saved.anchorY).toBeNull();
  });

  /** Half a point would put the pin on the left edge rather than nowhere. */
  it('refuses half a point anchor', async () => {
    const { service } = makeService();
    const saved = await service.addComment(
      RECORDING_ID, 'Somewhere', 'sb-1', undefined, undefined, { anchorX: 0.4 },
    );
    expect(saved.anchorX).toBeNull();
    expect(saved.anchorY).toBeNull();
  });

  it('anchors a guest comment too — the share page works logged out', async () => {
    const { service } = makeService();
    const saved = await service.addComment(
      RECORDING_ID, 'From a guest', undefined, 'g-123', undefined, { timecodeMs: 41_000 },
    );
    expect(saved.timecodeMs).toBe(41_000);
    expect(saved.guestId).toBe('g-123');
  });

  it('still reports a recording that does not exist', async () => {
    const { service, recordings } = makeService();
    recordings.findOne.mockResolvedValue(null);
    await expect(service.addComment(RECORDING_ID, 'hi', 'sb-1', undefined, undefined, { timecodeMs: 1 }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
