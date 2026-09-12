import { RecordingsService } from '../recordings.service';

/** Claiming is what makes a guest recording permanent.
 *
 * An unclaimed guest recording is deleted an hour after upload. Signing in and
 * claiming has to clear that deadline, or the sweep deletes a recording its
 * owner has just taken responsibility for — the worst possible version of this
 * feature, and one that would only show up an hour later. */

function service(rows: any[]) {
  const saved: any[] = [];
  const repo = {
    find: async () => rows,
    // claimRecordings saves the whole fetched array in one call, so unwrap it
    // rather than treating the argument as a single row.
    save: async (r: any) => { saved.push(...(Array.isArray(r) ? r : [r])); return r; },
  };
  const users = { findOrCreateBySupabaseId: async () => ({ id: 'u1', supabaseId: 'sb-1' }) };
  const svc = new RecordingsService(
    repo as any, {} as any, {} as any, {} as any, users as any, {} as any);
  return { svc, saved };
}

const guestRow = () => ({
  id: '3f1d2c4e-5a6b-4c8d-9e0f-1a2b3c4d5e6f',
  user: null,
  guestId: 'g-123',
  expiresAt: new Date('2026-09-13T13:00:00.000Z'),
});

describe('claiming a guest recording', () => {
  it('clears the expiry so the sweep leaves it alone', async () => {
    const row = guestRow();
    const { svc, saved } = service([row]);
    await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(saved).toHaveLength(1);
    expect(saved[0].expiresAt).toBeNull();
    expect(saved[0].guestId).toBeNull();
  });

  it('gives it an owner at the same time', async () => {
    const row = guestRow();
    const { svc, saved } = service([row]);
    await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(saved[0].user).toMatchObject({ supabaseId: 'sb-1' });
  });

  it('leaves another guest’s recording expiring, and unclaimed', async () => {
    const row = { ...guestRow(), guestId: 'someone-else' };
    const { svc, saved } = service([row]);
    const result = await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(result.claimed).toEqual([]);
    // The row is still written back — unchanged — because claim saves the whole
    // fetched set. What matters is that its deadline survived.
    expect(row.expiresAt).not.toBeNull();
    expect(row.user).toBeNull();
  });
});
