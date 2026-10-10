import { writeEndpointsApp } from './support/write-endpoints-app';

/** Finding 3 — a guest recording could be taken by anyone with its link;
 * finding 6 — a guest's reaction could be flipped by anyone with the link.
 *
 * A guestId is the only proof a guest has that a capture is theirs: claiming
 * an ownerless recording requires it, and a guest's reaction is keyed by it.
 * GET /recordings/:id is public and returned it — on the recording, on every
 * reaction and on every comment. So a signed-in stranger could read it off
 * the share link and claim the recording into their own account, and the
 * guest who made it lost it.
 *
 * The public view of a recording now carries no guestIds at all. Nothing on
 * the web reads them from it: ClaimCaptures works from the signed-in user's
 * own list. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

const anyGuestId = (body: unknown) => JSON.stringify(body).includes('guest_victim');

describe('a guest recording read from its share link', () => {
    it('does not reveal the guestId — not on the recording, reactions or comments', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        await t.call('post', `/recordings/${id}/reactions`, { type: 'like', guestId: 'guest_victim' });
        await t.call('post', `/recordings/${id}/comments`, { content: 'hi', guestId: 'guest_victim' });

        const { status, body } = await t.call('get', `/recordings/${id}`);
        expect(status).toBe(200);
        expect(body.reactions).toHaveLength(1);
        expect(body.comments).toHaveLength(1);
        expect(anyGuestId(body)).toBe(false);
    });

    it('so a signed-in stranger cannot claim it', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const { body } = await t.call('get', `/recordings/${id}`);
        const res = await t.call('post', '/recordings/claim',
            { recordingIds: [id], guestId: body.guestId ?? undefined }, t.token('sb-stranger'));

        expect(res.body.claimed ?? []).toEqual([]);
        const row = t.db.recordings.rows.get(id);
        expect(row.user ?? null).toBeNull();
        expect(row.guestId).toBe('guest_victim');
        expect(row.expiresAt).not.toBeNull();
    });

    it('the guest who made it can still claim it with their own guestId', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const res = await t.call('post', '/recordings/claim',
            { recordingIds: [id], guestId: 'guest_victim' }, t.token('sb-victim'));
        expect(res.body.claimed).toEqual([id]);
    });

    it('so nobody can flip a guest’s reaction without already knowing their guestId', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        await t.call('post', `/recordings/${id}/reactions`, { type: 'like', guestId: 'guest_victim' });
        const { body } = await t.call('get', `/recordings/${id}`);
        const leaked = body.reactions[0]?.guestId;
        expect(leaked).toBeUndefined();
    });
});
