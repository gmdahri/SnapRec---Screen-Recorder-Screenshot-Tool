import * as crypto from 'crypto';
import { writeEndpointsApp } from './support/write-endpoints-app';

/** No response carries a guest id. Any of them.
 *
 * A guest id is the only proof a guest has that a capture is theirs: claiming
 * an ownerless recording requires it, and a guest's reaction is keyed by it.
 * Hiding it on GET /recordings/:id was not enough — a comment's or reaction's
 * 201 echoed the whole recording row back, guest id included, to anyone
 * holding the link. So this drives every recordings endpoint that returns
 * data, as guests and as signed-in users, over rows that carry guest ids in
 * every place one can sit, and looks for any of them anywhere in any body. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

const GUEST_IDS = ['guest_victim', 'guest_commenter', 'guest_reactor', 'guest_legacy', 'guest_creator'];

it('appears in no response body, from any endpoint, for any caller', async () => {
    const owner = t.token('sb-owner');
    const viewer = t.token('sb-viewer');
    const responses: Array<{ what: string; status: number; body: unknown }> = [];
    const take = async (what: string, req: Promise<{ status: number; body: unknown }>) => {
        const res = await req;
        responses.push({ what, status: res.status, body: res.body });
        return res;
    };

    // A guest recording, created and then retried by its guest.
    const guestRec = { id: crypto.randomUUID(), title: 'g', fileUrl: `video-${crypto.randomUUID()}.webm`, type: 'video', guestId: 'guest_creator' };
    t.r2.objects.set(guestRec.fileUrl, 'f');
    await take('POST /recordings (guest)', t.call('post', '/recordings', guestRec));
    await take('POST /recordings (guest retry)', t.call('post', '/recordings', guestRec));

    // Another guest's recording, and an owned one that still carries a guest id
    // (what the old share page's takeover left behind).
    const { id: victimId } = await t.victim({ guestId: 'guest_victim' });
    const { id: ownedId } = await t.victim({ owner: 'sb-owner' });
    t.db.recordings.rows.get(ownedId).guestId = 'guest_legacy';

    for (const id of [victimId, ownedId]) {
        await take(`POST comments anon ${id}`, t.call('post', `/recordings/${id}/comments`, { content: 'hi', guestId: 'guest_commenter' }));
        await take(`POST comments signed-in ${id}`, t.call('post', `/recordings/${id}/comments`, { content: 'hi' }, viewer));
        await take(`POST reactions anon ${id}`, t.call('post', `/recordings/${id}/reactions`, { type: 'like', guestId: 'guest_reactor' }));
        await take(`POST reactions signed-in ${id}`, t.call('post', `/recordings/${id}/reactions`, { type: 'love' }, viewer));
        await take(`POST progress ${id}`, t.call('post', `/recordings/${id}/progress`, { ranges: [{ startSec: 0, endSec: 5 }] }, viewer));
        await take(`GET :id anon ${id}`, t.call('get', `/recordings/${id}`));
        await take(`GET :id signed-in ${id}`, t.call('get', `/recordings/${id}`, undefined, viewer));
    }
    await take('GET :id owner', t.call('get', `/recordings/${ownedId}`, undefined, owner));

    const comment = [...t.db.comments.rows.values()].find((c) => c.recording?.id === ownedId);
    await take('PATCH resolve (owner)', t.call('patch', `/recordings/${ownedId}/comments/${comment.id}/resolve`, { resolved: true }, owner));
    await take('PATCH :id (owner)', t.call('patch', `/recordings/${ownedId}`, { title: 'renamed' }, owner));
    t.r2.objects.set('video-owned-v2.webm', 'v2');
    await take('POST publish (owner)', t.call('post', `/recordings/${ownedId}/publish`, { fileUrl: 'video-owned-v2.webm' }, owner));
    await take('GET /recordings (owner list)', t.call('get', '/recordings', undefined, owner));
    await take('GET /recordings/shared by-me', t.call('get', '/recordings/shared?direction=by-me', undefined, owner));
    await take('GET /recordings/shared with-me', t.call('get', '/recordings/shared?direction=with-me', undefined, viewer));
    await take('POST claim (the guest, signed in)', t.call('post', '/recordings/claim', { recordingIds: [guestRec.id], guestId: 'guest_creator' }, viewer));
    await take('POST claim (a stranger)', t.call('post', '/recordings/claim', { recordingIds: [victimId], guestId: 'guest_wrong' }, viewer));

    // Every call above must actually have worked, or the sweep proves nothing.
    expect(responses.filter((r) => r.status >= 400).map((r) => `${r.what} -> ${r.status}`)).toEqual([]);

    const leaks = responses.flatMap((r) => GUEST_IDS
        .filter((g) => JSON.stringify(r.body ?? null).includes(g))
        .map((g) => `${r.what} leaks ${g}`));
    expect(leaks).toEqual([]);
});
