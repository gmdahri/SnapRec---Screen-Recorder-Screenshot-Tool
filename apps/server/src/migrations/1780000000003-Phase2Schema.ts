import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2Schema1780000000003 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sr_recordings
            ADD COLUMN IF NOT EXISTS "transcriptPublic" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
            ADD COLUMN IF NOT EXISTS "trialEnd" timestamptz
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE sr_recordings DROP COLUMN IF EXISTS "transcriptPublic"`,
        );
        await queryRunner.query(
            `ALTER TABLE sr_subscriptions DROP COLUMN IF EXISTS "trialEnd"`,
        );
    }
}
