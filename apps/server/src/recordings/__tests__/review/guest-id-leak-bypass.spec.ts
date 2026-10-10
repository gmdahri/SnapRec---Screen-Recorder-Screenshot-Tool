import { writeEndpointsApp } from '../support/write-endpoints-app';

/** Adversarial review of 7387ab2 ("stop exposing guestIds on the public
 * recording view").
 *
 * GET /recordings/:id no longer returns the recording's guestId, but two other
 * public endpoints still do. addComment and addReaction load the full
 * recording row (every column, guestId included), attach it to the new child
 * as `comment.recording` / `reaction.recording`, and return what save()
 * returns — the same object, recording and all. Real TypeORM save() returns
 * the entity instance it was given, so the fake's behaviour here matches.
 *
 * So anyone holding a share link can POST one anonymous comment (or reaction),
 * read `recording.guestId` off the 201 response, and a signed-in stranger can
 * then claim the guest's recording. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

describe('guestId leak through child-creation responses', () => {
    it('POST /recordings/:id/comments (anonymous) does not reveal the recording guestId', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const res = await t.call('post', `/recordings/${id}/comments`, { content: 'nice' });
        expect(res.status).toBe(201);
        expect(JSON.stringify(res.body)).not.toContain('guest_victim');
    });

    it('POST /recordings/:id/reactions (anonymous) does not reveal the recording guestId', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const res = await t.call('post', `/recordings/${id}/reactions`, { type: 'like', guestId: 'guest_attacker' });
        expect(res.status).toBe(201);
        expect(JSON.stringify(res.body)).not.toContain('guest_victim');
    });

    it('so a signed-in stranger cannot claim a guest recording via the comment response', async () => {
        const { id } = await t.victim({ guestId: 'guest_victim' });
        const leak = await t.call('post', `/recordings/${id}/comments`, { content: 'nice' });
        const leakedGuestId = leak.body?.recording?.guestId;

        const res = await t.call('post', '/recordings/claim',
            { recordingIds: [id], guestId: leakedGuestId }, t.token('sb-stranger'));

        expect(res.body.claimed ?? []).toEqual([]);
        const row = t.db.recordings.rows.get(id);
        expect(row.user ?? null).toBeNull();
        expect(row.guestId).toBe('guest_victim');
    });
});
