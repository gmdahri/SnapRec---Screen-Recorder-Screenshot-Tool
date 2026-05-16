import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3Schema1780000000004 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sr_users
            ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
            ADD COLUMN IF NOT EXISTS "aiMinutesPurchased" int NOT NULL DEFAULT 0
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE sr_users DROP COLUMN IF EXISTS "isAdmin"`,
        );
        await queryRunner.query(
            `ALTER TABLE sr_subscriptions DROP COLUMN IF EXISTS "aiMinutesPurchased"`,
        );
    }
}
