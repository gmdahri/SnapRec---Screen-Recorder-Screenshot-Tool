import { writeEndpointsApp } from './support/write-endpoints-app';

/** GET /recordings/:id is personal now — it says whether the viewer owns the
 * recording, wrote a comment, left a reaction — so no cache may hand one
 * viewer's answer to another.
 *
 * Nothing shared sits in front of the API (Google Frontend on the run.app
 * URL, no CDN: no Via/Age/cache headers in production). The risk is the
 * browser's own cache, keyed by URL and not by Authorization. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });

describe('caching of the personal recording view', () => {
    it('tells every cache not to store it, and that it varies by Authorization', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        for (const bearer of [undefined, t.token('sb-owner')]) {
            const res = await t.call('get', `/recordings/${id}`, undefined, bearer);
            expect(res.headers['cache-control']).toBe('private, no-store');
            expect(res.headers.vary).toMatch(/Authorization/i);
        }
    });

    it('two viewers of the same URL get their own flags', async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        const owner = await t.call('get', `/recordings/${id}`, undefined, t.token('sb-owner'));
        const other = await t.call('get', `/recordings/${id}`, undefined, t.token('sb-other'));
        const anon = await t.call('get', `/recordings/${id}`);
        expect([owner.body.viewerIsOwner, other.body.viewerIsOwner, anon.body.viewerIsOwner]).toEqual([true, false, false]);
    });

    it("revalidating with another viewer's ETag gets this viewer's answer, not a 304", async () => {
        const { id } = await t.victim({ owner: 'sb-owner' });
        const owner = await t.call('get', `/recordings/${id}`, undefined, t.token('sb-owner'));
        expect(owner.headers.etag).toBeTruthy();

        // A browser that stored the owner's response and revalidates it for
        // the next person to use the page.
        const res = await t.call('get', `/recordings/${id}`, undefined, t.token('sb-other'))
            .set('If-None-Match', owner.headers.etag);
        expect(res.status).toBe(200);
        expect(res.body.viewerIsOwner).toBe(false);
    });
});
