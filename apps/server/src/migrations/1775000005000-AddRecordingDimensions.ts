import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pixel dimensions of a capture, for the viewer's "1920×1080" line.
 *
 * Two integers rather than one "1920x1080" string: they are numbers, and a
 * string would have to be parsed back the moment anything wants to compare
 * resolutions, sort by them, or pick a bitrate band for the size estimate.
 *
 * Nullable and un-backfilled. Existing recordings were captured before anything
 * measured this, and the only honest value for them is "unknown" — the viewer
 * omits the line rather than guessing 1920×1080, which would be a fabricated
 * fact about someone's file.
 *
 * Not touched by publish: trimming and cutting change the length, never the
 * frame size, so a re-publish leaves these alone. */
export class AddRecordingDimensions1775000005000 implements MigrationInterface {
    name = 'AddRecordingDimensions1775000005000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_recordings" ADD COLUMN IF NOT EXISTS "widthPx" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "sr_recordings" ADD COLUMN IF NOT EXISTS "heightPx" integer
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN IF EXISTS "heightPx"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN IF EXISTS "widthPx"`);
    }
}
