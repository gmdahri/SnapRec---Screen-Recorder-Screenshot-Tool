import { ConflictException } from '@nestjs/common';
import { RecordingsService } from '../recordings.service';

/** create() must never write to a row that already exists.
 *
 * The HTTP spec (create-http.spec.ts) covers who may create what. This covers
 * the one case it cannot reach deterministically: two requests for the same
 * id racing past the existence check, where the database's own unique
 * violation (23505) is what has to be resolved the same way. */

const ID = '22222222-2222-4222-8222-222222222222';

function service({ raceWinner }: { raceWinner?: any } = {}) {
    const calls: string[] = [];
    let lookups = 0;
    const repo = {
        // The first lookup sees nothing — the other request has not committed
        // yet — and every later one sees its row.
        findOne: async () => { lookups++; return lookups === 1 ? null : raceWinner ?? null; },
        // No other recording holds the key (see assertKeyAvailable).
        find: async () => [],
        insert: async () => {
            calls.push('insert');
            if (raceWinner) throw Object.assign(new Error('duplicate key'), { code: '23505' });
            return { identifiers: [{ id: ID }] };
        },
        save: async () => { calls.push('save'); throw new Error('create() must not call save()'); },
    };
    const users = { findOrCreateBySupabaseId: async (supabaseId: string) => ({ id: 'u', supabaseId }) };
    const svc = new RecordingsService(repo as any, {} as any, {} as any, {} as any, users as any, {} as any);
    return { svc, calls };
}

const dto = (extra: object = {}) => ({ id: ID, title: 't', fileUrl: 'video-a.webm', type: 'video' as const, ...extra });

describe('create() under a race for the same id', () => {
    it('answers a racing retry from the same guest with the winner’s row, not a write', async () => {
        const winner = { id: ID, fileUrl: 'video-a.webm', type: 'video', user: null, guestId: 'guest_a' };
        const { svc, calls } = service({ raceWinner: winner });
        const result = await svc.create(dto({ guestId: 'guest_a' }));
        expect(result).toEqual({ recording: winner, created: false });
        expect(calls).toEqual(['insert']);
    });

    it('answers a racing stranger with a conflict', async () => {
        const winner = { id: ID, fileUrl: 'video-a.webm', type: 'video', user: { supabaseId: 'sb-owner' }, guestId: null };
        const { svc, calls } = service({ raceWinner: winner });
        await expect(svc.create(dto({ guestId: 'guest_b' }))).rejects.toBeInstanceOf(ConflictException);
        expect(calls).toEqual(['insert']);
    });

    it('never calls save(), the method that upserts', async () => {
        const { svc, calls } = service();
        await svc.create(dto({ userId: 'sb-owner' }));
        expect(calls).toEqual(['insert']);
    });
});
