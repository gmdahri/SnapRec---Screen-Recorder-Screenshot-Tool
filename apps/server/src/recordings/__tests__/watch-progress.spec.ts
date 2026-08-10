import { RecordingsService } from '../recordings.service';

/** P7 V4 — watch coverage.
 *
 * Two things are being protected here. The metric (O1): coverage, so skipping
 * to the end does not read as having watched. And the privacy shape (O2): no
 * per-person record for anyone who is not signed in. */

const VIEWER = 'sb-viewer';

function makeService(over: { durationSec?: number; existing?: any; views?: any[] } = {}) {
  const recording = { id: 'rec-1', durationSec: over.durationSec ?? 180 };
  const recordings = { findOne: jest.fn().mockResolvedValue(recording) };
  const saved: any[] = [];
  const views = {
    findOne: jest.fn().mockResolvedValue(over.existing ?? null),
    find: jest.fn().mockResolvedValue(over.views ?? []),
    create: jest.fn().mockImplementation((v: any) => ({ ...v })),
    save: jest.fn().mockImplementation(async (v: any) => { saved.push(v); return v; }),
  };
  const users = { findOrCreateBySupabaseId: jest.fn().mockResolvedValue({ id: 'user-1' }) };
  const service = new RecordingsService(
    recordings as any, {} as any, {} as any, views as any, users as any,
  );
  return { service, views, users, saved };
}

describe('recording what a viewer watched', () => {
  it('stores merged ranges and their total', async () => {
    const { service, saved } = makeService();
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 0, endSec: 30 }, { startSec: 20, endSec: 45 }], VIEWER,
    );
    expect(out).toEqual({ coveredSec: 45, recorded: true });
    expect(saved[0].watchedRangesJson).toEqual([{ startSec: 0, endSec: 45 }]);
  });

  it('accumulates across heartbeats', async () => {
    const existing = { watchedRangesJson: [{ startSec: 0, endSec: 30 }], coveredSec: 30 };
    const { service } = makeService({ existing });
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 100, endSec: 130 }], VIEWER,
    );
    expect(out.coveredSec).toBe(60);
  });

  /** The whole reason coverage was chosen over a high-water mark. */
  it('does not reward rewatching the same stretch', async () => {
    const existing = { watchedRangesJson: [{ startSec: 0, endSec: 60 }], coveredSec: 60 };
    const { service } = makeService({ existing });
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 0, endSec: 60 }], VIEWER,
    );
    expect(out.coveredSec).toBe(60);
  });

  /** A client reporting past the end would push coverage over 100%, which is
   * impossible — clamped at the source rather than hidden at the display. */
  it('clamps a range that runs past the end of the clip', async () => {
    const { service } = makeService({ durationSec: 100 });
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 0, endSec: 5000 }], VIEWER,
    );
    expect(out.coveredSec).toBe(100);
  });

  it('ignores ranges that cover nothing', async () => {
    const { service } = makeService();
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 30, endSec: 30 }, { startSec: 40, endSec: 20 }], VIEWER,
    );
    expect(out.coveredSec).toBe(0);
  });
});

describe('what is recorded about an anonymous viewer', () => {
  /** O2. The page is public, so the call must succeed — but nothing about the
   * person is stored, and no user row is minted for them. */
  it('accepts the heartbeat and stores nothing', async () => {
    const { service, views, users } = makeService();
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 0, endSec: 60 }], undefined,
    );
    expect(out).toEqual({ coveredSec: 0, recorded: false });
    expect(views.save).not.toHaveBeenCalled();
    expect(users.findOrCreateBySupabaseId).not.toHaveBeenCalled();
  });

  it('does not even look for an existing row', async () => {
    const { service, views } = makeService();
    await service.recordWatchProgress('rec-1', [{ startSec: 0, endSec: 60 }], undefined);
    expect(views.findOne).not.toHaveBeenCalled();
  });
});

describe('the figure shown to an owner', () => {
  it('is the mean coverage across signed-in viewers', async () => {
    const { service } = makeService({
      durationSec: 100,
      views: [{ coveredSec: 90 }, { coveredSec: 50 }],
    });
    expect(await service.watchedPercent('rec-1')).toBe(70);
  });

  /** "0%" reads as "nobody watched"; the truth is "we did not measure". */
  it('is null when no signed-in viewer has watched', async () => {
    const { service } = makeService({ views: [] });
    expect(await service.watchedPercent('rec-1')).toBeNull();
  });

  it('is null when the clip has no known length', async () => {
    const { service } = makeService({ durationSec: 0, views: [{ coveredSec: 10 }] });
    expect(await service.watchedPercent('rec-1')).toBeNull();
  });

  it('never exceeds 100', async () => {
    const { service } = makeService({ durationSec: 10, views: [{ coveredSec: 999 }] });
    expect(await service.watchedPercent('rec-1')).toBe(100);
  });
});
