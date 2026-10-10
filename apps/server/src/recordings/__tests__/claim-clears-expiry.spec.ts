import { RecordingsService } from '../recordings.service';

/** Claiming is what makes a guest recording permanent.
 *
 * An unclaimed guest recording is deleted an hour after upload. Signing in and
 * claiming has to clear that deadline, or the sweep deletes a recording its
 * owner has just taken responsibility for — the worst possible version of this
 * feature, and one that would only show up an hour later. */

const USER = { id: 'u1', supabaseId: 'sb-1' };
const usersById = new Map<string, any>([[USER.id, USER]]);
const userFor = (supabaseId: string) => {
  const u = supabaseId === USER.supabaseId ? USER : { id: `u-${supabaseId}`, supabaseId };
  usersById.set(u.id, u);
  return u;
};

/** claimRecordings writes each claim as a conditional UPDATE — still
 * ownerless, still the same guest — touching only the claim's columns. The
 * fake applies that to its rows the way Postgres would. */
function service(rows: any[]) {
  const repo = {
    find: async () => rows.map((r) => ({ ...r })),
    update: async (where: any, patch: any) => {
      const hits = rows.filter((r) => r.id === where.id && !r.user
        && (typeof where.guestId === 'string' ? r.guestId === where.guestId : r.guestId == null));
      for (const r of hits) Object.assign(r, patch, { user: usersById.get(patch.user?.id) ?? patch.user });
      return { affected: hits.length };
    },
  };
  const users = { findOrCreateBySupabaseId: async (supabaseId: string) => userFor(supabaseId) };
  const svc = new RecordingsService(
    repo as any, {} as any, {} as any, {} as any, users as any, {} as any);
  return { svc };
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
    const { svc } = service([row]);
    await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(row.expiresAt).toBeNull();
    expect(row.guestId).toBeNull();
  });

  it('gives it an owner at the same time', async () => {
    const row = guestRow();
    const { svc } = service([row]);
    await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(row.user).toMatchObject({ supabaseId: 'sb-1' });
  });

  it('leaves another guest’s recording expiring, and unclaimed', async () => {
    const row = { ...guestRow(), guestId: 'someone-else' };
    const { svc } = service([row]);
    const result = await svc.claimRecordings('sb-1', [row.id], undefined, 'g-123');
    expect(result.claimed).toEqual([]);
    expect(row.expiresAt).not.toBeNull();
    expect(row.user).toBeNull();
  });

  /** Two claims racing for one guest recording: the conditional UPDATE lets
   * exactly one of them through. Saving the loaded rows let both "win". */
  it('two accounts claiming it at once: exactly one gets it', async () => {
    const row = guestRow();
    const { svc } = service([row]);
    const [a, b] = await Promise.all([
      svc.claimRecordings('sb-1', [row.id], undefined, 'g-123'),
      svc.claimRecordings('sb-2', [row.id], undefined, 'g-123'),
    ]);
    expect([a.claimed.length, b.claimed.length].sort()).toEqual([0, 1]);
    const winner = a.claimed.length ? 'sb-1' : 'sb-2';
    expect((row as any).user.supabaseId).toBe(winner);
  });
});
