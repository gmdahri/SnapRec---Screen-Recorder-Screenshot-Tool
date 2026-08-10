import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-viewer watch progress, for the WATCHED figure (P7 V4).
 *
 * PRIVACY (plan O2): rows exist **only for signed-in viewers**. `userId` is NOT
 * NULL and there is deliberately no `guestId` column — anonymous viewers are
 * counted in `sr_recordings.views` and nothing else. That decision is what
 * keeps this out of consent-gate territory: nobody who never signed up gets an
 * individual behavioural record here.
 *
 * `watchedRangesJson` holds merged [start, end] second pairs rather than a
 * single furthest-point number, because the metric is coverage (plan O1): a
 * viewer who drags to the end has watched almost nothing, and a high-water mark
 * cannot tell the difference.
 *
 * One row per (recording, viewer) — progress accumulates into it rather than
 * appending an event per heartbeat, which would grow without bound for a video
 * someone leaves open.
 *
 * ON DELETE CASCADE on both sides: deleting a recording or a user must not
 * leave orphan behavioural data behind. */
export class AddRecordingViews1775000004000 implements MigrationInterface {
    name = 'AddRecordingViews1775000004000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sr_recording_views" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "recordingId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "watchedRangesJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "coveredSec" integer NOT NULL DEFAULT 0,
                "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sr_recording_views" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_sr_recording_views_recording_user"
                    UNIQUE ("recordingId", "userId"),
                CONSTRAINT "FK_sr_recording_views_recording"
                    FOREIGN KEY ("recordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_sr_recording_views_user"
                    FOREIGN KEY ("userId") REFERENCES "sr_users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sr_recording_views_recordingId"
            ON "sr_recording_views" ("recordingId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sr_recording_views_recordingId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sr_recording_views"`);
    }
}
