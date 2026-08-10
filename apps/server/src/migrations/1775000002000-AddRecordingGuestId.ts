import { MigrationInterface, QueryRunner } from 'typeorm';

/** Scopes guest-capture claiming.
 *
 * SECURITY: without this column, POST /recordings/claim transfers ANY ownerless
 * recording to whoever supplies its id. Share links expose recording ids, so a
 * guest who shares a link hands anyone who opens it the ability to claim
 * ownership of that capture.
 *
 * Recording it at upload time lets the claim be scoped to "recordings this
 * guest actually made" rather than "recordings nobody owns yet".
 *
 * Nullable and un-backfilled on purpose: existing ownerless rows have no known
 * guest, and inventing one would either lock their real owner out or hand them
 * to the wrong person. They stay claimable by id — see the note in
 * RecordingsService.claimRecordings. */
export class AddRecordingGuestId1775000002000 implements MigrationInterface {
    name = 'AddRecordingGuestId1775000002000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_recordings"
            ADD COLUMN IF NOT EXISTS "guestId" character varying
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sr_recordings_guestId"
            ON "sr_recordings" ("guestId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sr_recordings_guestId"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN IF EXISTS "guestId"`);
    }
}
