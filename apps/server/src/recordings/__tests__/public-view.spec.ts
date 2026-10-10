import { avatarFor, displayName, writeEndpointsApp } from './support/write-endpoints-app';

/** What GET /recordings/:id tells anyone holding the link about people.
 *
 * It is public — no account needed — and it returned the owner's, every
 * commenter's and every reactor's full user row: email, internal id, auth
 * (Supabase) id and timestamps, plus the internal id of whoever resolved a
 * comment. The page needs a display name and an avatar. Whether the viewer
 * owns the recording or wrote a comment is answered by the server as flags,
 * so no id has to be sent for the page to compare. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

async function recordingWithPeople() {
    const { id } = await t.victim({ owner: 'sb-owner' });
    await t.call('post', `/recordings/${id}/comments`, { content: 'from a viewer' }, t.token('sb-commenter'));
    await t.call('post', `/recordings/${id}/comments`, { content: 'owner reply' }, t.token('sb-owner'));
    await t.call('post', `/recordings/${id}/reactions`, { type: 'like' }, t.token('sb-commenter'));
    const commentId = [...t.db.comments.rows.values()].find((c) => c.content === 'from a viewer').id;
    await t.call('patch', `/recordings/${id}/comments/${commentId}/resolve`, { resolved: true }, t.token('sb-owner'));
    return id;
}

const SECRETS = ['@example.com', 'sb-owner', 'sb-commenter', 'row-sb-'];

describe('people on the public recording view', () => {
    it('carries no email, auth id or internal id for anyone', async () => {
        const id = await recordingWithPeople();
        const { status, body } = await t.call('get', `/recordings/${id}`);
        expect(status).toBe(200);
        const json = JSON.stringify(body);
        for (const secret of SECRETS) expect({ secret, found: json.includes(secret) }).toEqual({ secret, found: false });
        expect(body.comments.every((c: any) => !('resolvedByUserId' in c))).toBe(true);
    });

    it('carries the display name and avatar the page shows', async () => {
        const id = await recordingWithPeople();
        const { body } = await t.call('get', `/recordings/${id}`);
        expect(body.user).toEqual({ fullName: displayName('sb-owner'), avatarUrl: avatarFor('sb-owner') });
        const viewerComment = body.comments.find((c: any) => c.content === 'from a viewer');
        expect(viewerComment.user).toEqual({ fullName: displayName('sb-commenter'), avatarUrl: avatarFor('sb-commenter') });
        expect(viewerComment.resolvedAt).toBeTruthy();   // still says it is resolved, just not by whom
    });

    it('answers "is this mine" for the viewer instead of sending ids to compare', async () => {
        const id = await recordingWithPeople();
        const anon = (await t.call('get', `/recordings/${id}`)).body;
        const owner = (await t.call('get', `/recordings/${id}`, undefined, t.token('sb-owner'))).body;
        const commenter = (await t.call('get', `/recordings/${id}`, undefined, t.token('sb-commenter'))).body;

        expect([anon.viewerIsOwner, owner.viewerIsOwner, commenter.viewerIsOwner]).toEqual([false, true, false]);
        const byContent = (b: any, content: string) => b.comments.find((c: any) => c.content === content);
        expect(byContent(commenter, 'from a viewer').viewerIsAuthor).toBe(true);
        expect(byContent(owner, 'from a viewer').viewerIsAuthor).toBe(false);
        expect(byContent(anon, 'owner reply').byOwner).toBe(true);        // viewer-independent: drives "needs reply"
        expect(byContent(anon, 'from a viewer').byOwner).toBe(false);
        expect(commenter.reactions[0].viewerReacted).toBe(true);
        expect(owner.reactions[0].viewerReacted).toBe(false);
    });

    it('a lapsed session still sees the page — as anonymous, not 401', async () => {
        const id = await recordingWithPeople();
        const res = await t.call('get', `/recordings/${id}`, undefined, t.token('sb-owner', -60));
        expect(res.status).toBe(200);
        expect(res.body.viewerIsOwner).toBe(false);
    });
});
