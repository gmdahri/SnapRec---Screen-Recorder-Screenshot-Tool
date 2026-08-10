import { MigrationInterface, QueryRunner } from 'typeorm';

/** Sharing visibility for the Shared surface (P3, scene SHAR).
 *
 * Until now every uploaded recording was reachable by anyone holding the link,
 * so `isPublic` defaults to true — backfilling false would silently revoke
 * every link already in circulation.
 *
 * `sharingDisabledAt` records a link the owner turned OFF, which is different
 * from one that was never public: the UI has to offer turning it back on. */
export class AddRecordingVisibility1775000001000 implements MigrationInterface {
    name = 'AddRecordingVisibility1775000001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_recordings"
            ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS "sharingDisabledAt" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_recordings"
            DROP COLUMN IF EXISTS "isPublic",
            DROP COLUMN IF EXISTS "sharingDisabledAt"
        `);
    }
}
