/** Assigns a legacy ownerless recording to an owner. An admin tool, not an
 * endpoint.
 *
 * The public claim (POST /recordings/claim) only hands over an ownerless
 * recording to the guest whose guest id it carries. A row with no guest id —
 * from before the column existed, or registered anonymously without one —
 * proves nothing about who made it, so no one can claim it from the web any
 * more. When its maker gets in touch, confirm out of band that it is theirs,
 * then run:
 *
 *   npm run script:assign-legacy-recording -- <recordingId> <ownerSupabaseId>          # dry run
 *   APPLY=1 npm run script:assign-legacy-recording -- <recordingId> <ownerSupabaseId>  # writes
 *
 * It refuses anything that is not a legacy row (already owned, or carrying a
 * guest id — those have their own path), never creates a user (the owner must
 * have signed in at least once), and writes with the same conditions it
 * checked, so a row that changed in between is left alone. */
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Reaction } from '../recordings/entities/reaction.entity';
import { Comment } from '../recordings/entities/comment.entity';
import { VideoProject } from '../video-projects/entities/video-project.entity';
import { RecordingView } from '../recordings/entities/recording-view.entity';

export type AssignOutcome =
    | { ok: true; applied: boolean; recordingId: string; owner: string }
    | { ok: false; reason: string };

export async function assignLegacyRecording(
    recordings: Pick<Repository<Recording>, 'findOne' | 'update'>,
    users: Pick<Repository<User>, 'findOne'>,
    { recordingId, ownerSupabaseId, apply }: { recordingId: string; ownerSupabaseId: string; apply: boolean },
): Promise<AssignOutcome> {
    const recording = await recordings.findOne({ where: { id: recordingId }, relations: ['user'] });
    if (!recording) return { ok: false, reason: 'no such recording' };
    if (recording.user) return { ok: false, reason: 'already owned' };
    if (recording.guestId) return { ok: false, reason: 'carries a guest id — its guest can claim it from the web' };

    const owner = await users.findOne({ where: { supabaseId: ownerSupabaseId } });
    if (!owner) return { ok: false, reason: 'no such user (they must have signed in at least once)' };

    if (apply) {
        const { affected } = await recordings.update(
            { id: recordingId, user: IsNull(), guestId: IsNull() },
            { user: { id: owner.id }, expiresAt: null },
        );
        if (!affected) return { ok: false, reason: 'the recording changed since it was checked; nothing written' };
    }
    return { ok: true, applied: apply, recordingId, owner: ownerSupabaseId };
}

async function main() {
    const [recordingId, ownerSupabaseId] = process.argv.slice(2);
    const apply = process.env.APPLY === '1';
    if (!recordingId || !ownerSupabaseId) {
        console.error('usage: [APPLY=1] npm run script:assign-legacy-recording -- <recordingId> <ownerSupabaseId>');
        process.exit(2);
    }
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Recording, Reaction, Comment, VideoProject, RecordingView],
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
    await dataSource.initialize();
    try {
        const outcome = await assignLegacyRecording(
            dataSource.getRepository(Recording), dataSource.getRepository(User),
            { recordingId, ownerSupabaseId, apply });
        if (!outcome.ok) {
            console.error(`Refused: ${outcome.reason}`);
            process.exitCode = 1;
        } else {
            console.log(outcome.applied
                ? `Assigned ${outcome.recordingId} to ${outcome.owner}; it no longer expires.`
                : `Dry run: ${outcome.recordingId} can be assigned to ${outcome.owner}. Re-run with APPLY=1 to write.`);
        }
    } finally {
        await dataSource.destroy();
    }
}

if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
