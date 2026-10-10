import { assignLegacyRecording } from '../assign-legacy-recording';

/** The admin path for legacy ownerless recordings, now that the public claim
 * refuses a row with no guest id. */

const OWNER = { id: 'row-sb-owner', supabaseId: 'sb-owner' };

function repos(row: any) {
    const recordings = {
        findOne: async () => (row ? { ...row } : null),
        update: jest.fn(async (where: any, patch: any) => {
            const stillLegacy = row && row.id === where.id && !row.user && !row.guestId;
            if (stillLegacy) Object.assign(row, patch, { user: OWNER });
            return { affected: stillLegacy ? 1 : 0 };
        }),
    };
    const users = { findOne: async ({ where }: any) => (where.supabaseId === OWNER.supabaseId ? OWNER : null) };
    return { recordings, users };
}

const legacy = () => ({ id: 'r1', user: null, guestId: null, expiresAt: null });
const run = (row: any, opts: Partial<{ ownerSupabaseId: string; apply: boolean }> = {}) => {
    const r = repos(row);
    return { r, out: assignLegacyRecording(r.recordings as any, r.users as any, { recordingId: 'r1', ownerSupabaseId: 'sb-owner', apply: false, ...opts }) };
};

describe('assignLegacyRecording', () => {
    it('dry run by default: says it can, writes nothing', async () => {
        const { r, out } = run(legacy());
        expect(await out).toEqual({ ok: true, applied: false, recordingId: 'r1', owner: 'sb-owner' });
        expect(r.recordings.update).not.toHaveBeenCalled();
    });

    it('with apply, assigns it and clears any expiry', async () => {
        const row: any = { ...legacy(), expiresAt: new Date() };
        const { out } = run(row, { apply: true });
        expect(await out).toMatchObject({ ok: true, applied: true });
        expect(row.user).toEqual(OWNER);
        expect(row.expiresAt).toBeNull();
    });

    it('refuses a row that is already owned', async () => {
        const { r, out } = run({ ...legacy(), user: { supabaseId: 'sb-someone' } }, { apply: true });
        expect(await out).toEqual({ ok: false, reason: 'already owned' });
        expect(r.recordings.update).not.toHaveBeenCalled();
    });

    it('refuses a row with a guest id — its guest claims it from the web', async () => {
        const { out } = run({ ...legacy(), guestId: 'guest_a' }, { apply: true });
        expect(await out).toMatchObject({ ok: false, reason: expect.stringMatching(/guest id/) });
    });

    it('never creates a user', async () => {
        const { out } = run(legacy(), { ownerSupabaseId: 'sb-nobody', apply: true });
        expect(await out).toMatchObject({ ok: false, reason: expect.stringMatching(/no such user/) });
    });

    it('writes nothing if the row changed between the check and the write', async () => {
        const row: any = legacy();
        const r = repos(row);
        const findOne = r.recordings.findOne;
        r.recordings.findOne = async () => { const snap = await findOne(); row.guestId = 'guest_late'; return snap; };
        const out = await assignLegacyRecording(r.recordings as any, r.users as any, { recordingId: 'r1', ownerSupabaseId: 'sb-owner', apply: true });
        expect(out).toMatchObject({ ok: false, reason: expect.stringMatching(/changed/) });
        expect(row.user).toBeNull();
    });
});
