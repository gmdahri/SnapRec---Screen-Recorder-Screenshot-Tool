import * as crypto from 'crypto';
import { writeEndpointsApp } from './support/write-endpoints-app';

/** Finding 2 — anyone could delete any stored file; finding 5 — an owner
 * could point their recording at somebody else's.
 *
 * A recording's fileUrl is an R2 key, and nothing tied a key to the recording
 * whose upload created it. POST /recordings accepted any key, anonymously; an
 * anonymous recording expires in an hour; and the sweep deletes an expired
 * recording's key from R2. So: read a victim's key off their share link,
 * register a guest recording pointing at it, and an hour later the sweep
 * deletes the victim's file. PATCH, publish and the video editor's
 * newFileUrl let an owner repoint their own row the same way.
 *
 * The rule: a key belongs to the first recording that registered it, and the
 * sweep never deletes a key that some other recording still uses. */

let t: Awaited<ReturnType<typeof writeEndpointsApp>>;
beforeEach(async () => { t = await writeEndpointsApp(); });
afterEach(async () => { await t.close(); });


async function runSweep(hoursLater: number) {
    const { RecordingsService } = await import('../recordings.service');
    const svc = t.app.get(RecordingsService);
    return svc.sweepExpired(new Date(Date.now() + hoursLater * 3600e3));
}

describe('deleting someone else’s file through the sweep', () => {
    it('an anonymous recording cannot be registered on another recording’s key', async () => {
        const { id, key } = await t.victim({ owner: 'sb-owner' });
        const leaked = await t.keyFromShareLink(id);
        const res = await t.call('post', '/recordings',
            { id: crypto.randomUUID(), title: 'x', fileUrl: leaked, type: 'video', guestId: 'guest_attacker' });
        expect(res.status).toBe(409);

        await runSweep(2);
        expect(t.r2.objects.has(key)).toBe(true);
    });

    it('the sweep spares a file still used by another recording, even if a row already points at it', async () => {
        // A row planted before this fix shipped is already in the table.
        const { key } = await t.victim({ owner: 'sb-owner' });
        await t.db.recordings.insert({
            id: crypto.randomUUID(), title: 'planted', fileUrl: key, type: 'video',
            user: null, guestId: 'guest_attacker', expiresAt: new Date(Date.now() - 1000),
        });
        const result = await runSweep(0);
        expect(result.deleted).toBe(1);                 // the planted row goes
        expect(t.r2.objects.has(key)).toBe(true);       // the victim's file stays
        expect([...t.db.recordings.rows.values()].filter((r) => r.fileUrl === key)).toHaveLength(1);
    });

    it('the sweep still deletes an expired recording’s own file', async () => {
        const { key } = await t.victim({ guestId: 'guest_a' });
        await runSweep(2);
        expect(t.r2.objects.has(key)).toBe(false);
    });
});

describe('an owner repointing their recording at someone else’s file', () => {
    async function attackerRecording() {
        return t.victim({ owner: 'sb-attacker', key: 'video-attacker.webm' });
    }

    it('PATCH :id with another recording’s key -> 409, unchanged', async () => {
        const { key } = await t.victim({ owner: 'sb-owner' });
        const mine = await attackerRecording();
        const res = await t.call('patch', `/recordings/${mine.id}`, { fileUrl: key }, t.token('sb-attacker'));
        expect(res.status).toBe(409);
        expect(t.db.recordings.rows.get(mine.id).fileUrl).toBe('video-attacker.webm');
    });

    it('publish with another recording’s key -> 409, unchanged', async () => {
        const { key } = await t.victim({ owner: 'sb-owner' });
        const mine = await attackerRecording();
        const res = await t.call('post', `/recordings/${mine.id}/publish`, { fileUrl: key }, t.token('sb-attacker'));
        expect(res.status).toBe(409);
        expect(t.db.recordings.rows.get(mine.id).fileUrl).toBe('video-attacker.webm');
    });

    it('publishing a freshly uploaded file still works', async () => {
        const mine = await attackerRecording();
        t.r2.objects.set('video-attacker-v2.webm', 'new cut');
        const res = await t.call('post', `/recordings/${mine.id}/publish`, { fileUrl: 'video-attacker-v2.webm' }, t.token('sb-attacker'));
        expect(res.status).toBe(201);
        expect(t.db.recordings.rows.get(mine.id).fileUrl).toBe('video-attacker-v2.webm');
    });

    it('an idempotent retry of a registration is not mistaken for reuse of a key', async () => {
        const id = crypto.randomUUID();
        const body = { id, title: 'v', fileUrl: 'video-retry.webm', type: 'video', guestId: 'guest_a' };
        expect((await t.call('post', '/recordings', body)).status).toBe(201);
        expect((await t.call('post', '/recordings', body)).status).toBe(200);
    });
});
