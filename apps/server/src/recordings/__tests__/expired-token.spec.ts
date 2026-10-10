import * as crypto from 'crypto';
import { writeEndpointsApp } from './support/write-endpoints-app';

/** Finding 4 — an expired session silently became a guest.
 *
 * OptionalJwtAuthGuard turned any token that failed to verify into "no user".
 * A signed-in client whose session had lapsed was therefore treated as a
 * guest without being told: a recording it registered became an anonymous
 * row with no guestId, unclaimable and deleted by the sweep an hour later; a
 * comment or reaction was posted as nobody.
 *
 * A request that carries no token is a guest, as before. A request that
 * carries one is a signed-in client, and if that token does not verify the
 * answer is 401 — so the client can say "your session expired" and keep the
 * user's work instead of quietly filing it under nobody. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

const recordingBody = () => ({ id: crypto.randomUUID(), title: 'v', fileUrl: `video-${crypto.randomUUID()}.webm`, type: 'video' });

describe('a token that does not verify', () => {
    it('POST /recordings with an expired token -> 401, nothing registered', async () => {
        const res = await t.call('post', '/recordings', recordingBody(), t.token('sb-user', -60));
        expect(res.status).toBe(401);
        expect(t.db.recordings.rows.size).toBe(0);
    });

    it('POST /recordings with a garbage token -> 401', async () => {
        const res = await t.call('post', '/recordings', recordingBody(), 'not-a-jwt');
        expect(res.status).toBe(401);
    });

    it('comments and reactions with an expired token -> 401, nothing posted', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        const c = await t.call('post', `/recordings/${id}/comments`, { content: 'hi' }, t.token('sb-user', -60));
        const r = await t.call('post', `/recordings/${id}/reactions`, { type: 'like' }, t.token('sb-user', -60));
        expect([c.status, r.status]).toEqual([401, 401]);
        expect(t.db.comments.rows.size).toBe(0);
        expect(t.db.reactions.rows.size).toBe(0);
    });
});

describe('no token at all is still a guest', () => {
    it('registers a guest recording', async () => {
        const res = await t.call('post', '/recordings', { ...recordingBody(), guestId: 'guest_a' });
        expect(res.status).toBe(201);
    });

    it('comments as a guest', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        const res = await t.call('post', `/recordings/${id}/comments`, { content: 'hi', guestId: 'guest_a' });
        expect(res.status).toBe(201);
    });
});
