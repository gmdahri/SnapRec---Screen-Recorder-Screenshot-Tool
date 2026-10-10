import { RecordingsService } from '../../recordings.service';

/** A page view can undo a claim, and the sweep then deletes the recording.
 *
 * findOne() — GET /recordings/:id, which the share page also polls every few
 * seconds while a file processes — loads the whole row and save()s it back
 * to bump `views`. TypeORM's save() writes every column that differs from
 * the database, so if a claim commits between that load and that save, the
 * stale copy writes the old owner (none), the old guestId and the old
 * one-hour expiry back. Confirmed against a real Postgres: claimed, then a
 * stale view save -> owner null, guestId restored, expiresAt set.
 *
 * The fake below lets the claim land in exactly that window and gives save()
 * TypeORM's write-back semantics for the columns involved. Fix-agnostic: it
 * only asserts the claim survives a concurrent view. */

const ID = '33333333-3333-4333-8333-333333333333';

it('a page view that loaded the row before a claim does not undo the claim', async () => {
    const row: any = { id: ID, views: 0, user: null, guestId: 'guest_v', expiresAt: new Date(Date.now() + 3600e3), fileUrl: 'k.webm' };
    const claimer = { id: 'row-sb-claimer', supabaseId: 'sb-claimer' };
    let claimDuringView: (() => Promise<void>) | null = null;

    const repo = {
        findOne: async ({ relations }: any) => {
            const snapshot = { ...row };
            // The GET's load returns; the claim commits before its save.
            if (relations?.includes('comments') && claimDuringView) { const c = claimDuringView; claimDuringView = null; await c(); }
            return snapshot;
        },
        find: async () => [{ ...row }],
        save: async (e: any) => {
            for (const r of Array.isArray(e) ? e : [e]) {
                for (const k of ['views', 'user', 'guestId', 'expiresAt']) if (k in r) row[k] = r[k];
            }
            return e;
        },
        increment: async (_where: any, col: string, by: number) => { row[col] += by; return { affected: 1 }; },
        // As TypeORM: returns an UpdateResult, and a relation set by id reads
        // back as the full row.
        update: async (_where: any, patch: any) => {
            Object.assign(row, patch, patch.user?.id === claimer.id ? { user: claimer } : {});
            return { affected: 1 };
        },
        createQueryBuilder: () => { throw new Error('not modelled'); },
    };
    const users = { findOrCreateBySupabaseId: async () => claimer };
    const svc = new RecordingsService(repo as any, {} as any, {} as any, {} as any, users as any, {} as any);

    claimDuringView = async () => { await svc.claimRecordings('sb-claimer', [ID], undefined, 'guest_v'); };
    await svc.findOne(ID);

    expect(row.user).toEqual(claimer);
    expect(row.guestId).toBeNull();
    expect(row.expiresAt).toBeNull();
});
