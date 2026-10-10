import { writeEndpointsApp } from '../support/write-endpoints-app';

/** Adjacent to 8c3a27e (OptionalJwtAuthGuard): what a request with NO
 * Authorization header can do on the reactions endpoint.
 *
 * addReaction looks up the caller's existing reaction with
 *   { recording: { id }, guestId }
 * and guestId is optional in AddReactionDto. With no token and no guestId the
 * where clause is { recording: { id }, guestId: undefined }; TypeORM drops
 * undefined keys from a where, so it matches the FIRST reaction on the
 * recording — a signed-in user's included — and toggles it off (same type) or
 * rewrites its type (different type). The fake matches the same row
 * (undefined === absent), so this is not a fake artefact. Pre-existing, not
 * introduced by the reviewed commits. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

it('an anonymous reaction with no guestId does not remove a signed-in user’s reaction', async () => {
    const { id } = await t.victim({ owner: 'sb-owner' });
    const mine = await t.call('post', `/recordings/${id}/reactions`, { type: 'love' }, t.token('sb-fan'));
    expect(mine.status).toBe(201);

    await t.call('post', `/recordings/${id}/reactions`, { type: 'love' }); // no token, no guestId

    const fans = [...t.db.reactions.rows.values()].filter((r) => r.user?.supabaseId === 'sb-fan');
    expect(fans).toHaveLength(1);
    expect(fans[0].type).toBe('love');
});

describe('a reaction with nobody behind it', () => {
    it('no token and no guest id -> 400, and nothing is written', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        await t.call('post', `/recordings/${id}/reactions`, { type: 'love' }, t.token('sb-fan'));
        const before = [...t.db.reactions.rows.values()].map((r) => ({ ...r }));

        const res = await t.call('post', `/recordings/${id}/reactions`, { type: 'like' });
        expect(res.status).toBe(400);
        expect([...t.db.reactions.rows.values()]).toEqual(before);
    });

    it('an empty guest id is no guest id -> 400', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        const res = await t.call('post', `/recordings/${id}/reactions`, { type: 'like', guestId: '' });
        expect(res.status).toBe(400);
        expect(t.db.reactions.rows.size).toBe(0);
    });

    it('a guest with a guest id still reacts, and only toggles their own reaction', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        await t.call('post', `/recordings/${id}/reactions`, { type: 'love' }, t.token('sb-fan'));
        const res = await t.call('post', `/recordings/${id}/reactions`, { type: 'love', guestId: 'guest_a' });
        expect(res.status).toBe(201);
        const rows = [...t.db.reactions.rows.values()];
        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r.user?.supabaseId === 'sb-fan')?.type).toBe('love');
    });
});
