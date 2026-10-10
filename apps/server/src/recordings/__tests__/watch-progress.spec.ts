import { RecordingsService } from '../recordings.service';

/** P7 V4 — watch coverage.
 *
 * Two things are being protected here. The metric (O1): coverage, so skipping
 * to the end does not read as having watched. And the privacy shape (O2): no
 * per-person record for anyone who is not signed in. */

const VIEWER = 'sb-viewer';

/** sr_recording_views as Postgres treats it, one row per viewer.
 *
 * Every statement takes a tick, as a database round trip does, so concurrent
 * heartbeats interleave. Both protocols are modelled: the transaction the
 * service uses (INSERT … ON CONFLICT DO NOTHING, SELECT … FOR UPDATE, which
 * waits for the row's lock, UPDATE), and the repository read-then-save it
 * used to, so a test can show what that lost. */
function viewsTable() {
  let row: any = null;
  let locked: Promise<void> | null = null;
  const tick = () => new Promise((r) => setTimeout(r, 1));
  const stats = { transactions: 0 };
  const repo = {
    stats,
    stored: () => row,
    seed: (r: any) => { row = r; },
    find: jest.fn(),
    findOne: jest.fn(async () => { await tick(); return row ? { ...row, watchedRangesJson: [...row.watchedRangesJson] } : null; }),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => {
      await tick();
      if (!v.id && row) throw Object.assign(new Error('duplicate key'), { code: '23505' });
      row = { ...v, id: v.id ?? 'view-1' };
      return row;
    }),
    manager: {
      transaction: async (work: (m: any) => Promise<unknown>) => {
        stats.transactions++;
        let release = () => {};
        const m = {
          query: async (sql: string, params: any[]) => {
            await tick();
            if (sql.includes('INSERT INTO')) {
              if (!row) row = { id: 'view-1', watchedRangesJson: [], coveredSec: 0 };
              return [];
            }
            if (sql.includes('FOR UPDATE')) {
              while (locked) await locked;
              locked = new Promise<void>((r) => { release = () => { locked = null; r(); }; });
              return [{ id: row.id, watchedRangesJson: [...row.watchedRangesJson] }];
            }
            if (sql.startsWith('UPDATE') || sql.trim().startsWith('UPDATE')) {
              row = { ...row, watchedRangesJson: JSON.parse(params[0]), coveredSec: params[1] };
              return [];
            }
            throw new Error(`fake: unexpected SQL ${sql}`);
          },
        };
        try { return await work(m); } finally { release(); }
      },
    },
  };
  return repo;
}

function makeService(over: { durationSec?: number; existing?: any; views?: any[] } = {}) {
  const recording = { id: 'rec-1', durationSec: over.durationSec ?? 180 };
  const recordings = { findOne: jest.fn().mockResolvedValue(recording) };
  const views = viewsTable();
  if (over.existing) views.seed({ id: 'view-1', ...over.existing });
  views.find.mockResolvedValue(over.views ?? []);
  const users = { findOrCreateBySupabaseId: jest.fn().mockResolvedValue({ id: 'user-1' }) };
  const service = new RecordingsService(
    recordings as any, {} as any, {} as any, views as any, users as any,
    {} as any, // storageService — used only by the expiry sweep
  );
  return { service, views, users };
}

describe('recording what a viewer watched', () => {
  it('stores merged ranges and their total', async () => {
    const { service, views } = makeService();
    const out = await service.recordWatchProgress(
      'rec-1', [{ startSec: 0, endSec: 30 }, { startSec: 20, endSec: 45 }], VIEWER,
    );
    expect(out).toEqual({ coveredSec: 45, recorded: true });
    expect(views.stored().watchedRangesJson).toEqual([{ startSec: 0, endSec: 45 }]);
    expect(views.stored().coveredSec).toBe(45);
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

/** Heartbeats in flight together.
 *
 * Reading the row, merging in memory and saving it back let each concurrent
 * heartbeat write its own merge over the other's, so ranges were lost; and two
 * first heartbeats both inserted, so all but one failed on the unique
 * constraint. Reproduced on a real Postgres: ten simultaneous heartbeats over
 * a 100 s clip kept 10–20 s, and nine of ten first ones errored. */
describe('heartbeats that arrive together', () => {
  const tenths = () => Array.from({ length: 10 }, (_, i) => [{ startSec: i * 10, endSec: i * 10 + 10 }]);

  it('keep every range', async () => {
    const { service, views } = makeService({ durationSec: 100, existing: { watchedRangesJson: [{ startSec: 0, endSec: 5 }], coveredSec: 5 } });
    await Promise.all(tenths().map((r) => service.recordWatchProgress('rec-1', r, VIEWER)));
    expect(views.stored().coveredSec).toBe(100);
    expect(views.stored().watchedRangesJson).toEqual([{ startSec: 0, endSec: 100 }]);
  });

  it('a viewer\u2019s first heartbeats do not fail on each other', async () => {
    const { service, views } = makeService({ durationSec: 100 });
    const out = await Promise.allSettled(tenths().map((r) => service.recordWatchProgress('rec-1', r, VIEWER)));
    expect(out.filter((o) => o.status === 'rejected')).toEqual([]);
    expect(views.stored().coveredSec).toBe(100);
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
    expect(views.stored()).toBeNull();
    expect(views.stats.transactions).toBe(0);
    expect(users.findOrCreateBySupabaseId).not.toHaveBeenCalled();
  });

  it('does not even look for an existing row', async () => {
    const { service, views } = makeService();
    await service.recordWatchProgress('rec-1', [{ startSec: 0, endSec: 60 }], undefined);
    expect(views.findOne).not.toHaveBeenCalled();
    expect(views.stats.transactions).toBe(0);
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
