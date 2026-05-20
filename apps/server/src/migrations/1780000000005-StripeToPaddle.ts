import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripeToPaddle1780000000005 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
                RENAME COLUMN "stripeCustomerId" TO "paddleCustomerId"
        `);
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
                RENAME COLUMN "stripeSubscriptionId" TO "paddleSubscriptionId"
        `);
        await queryRunner.query(
            `ALTER INDEX IF EXISTS "IDX_sr_subscriptions_stripeCustomerId" RENAME TO "IDX_sr_subscriptions_paddleCustomerId"`,
        );
        await queryRunner.query(
            `ALTER INDEX IF EXISTS "IDX_sr_subscriptions_stripeSubscriptionId" RENAME TO "IDX_sr_subscriptions_paddleSubscriptionId"`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER INDEX IF EXISTS "IDX_sr_subscriptions_paddleCustomerId" RENAME TO "IDX_sr_subscriptions_stripeCustomerId"`,
        );
        await queryRunner.query(
            `ALTER INDEX IF EXISTS "IDX_sr_subscriptions_paddleSubscriptionId" RENAME TO "IDX_sr_subscriptions_stripeSubscriptionId"`,
        );
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
                RENAME COLUMN "paddleCustomerId" TO "stripeCustomerId"
        `);
        await queryRunner.query(`
            ALTER TABLE sr_subscriptions
                RENAME COLUMN "paddleSubscriptionId" TO "stripeSubscriptionId"
        `);
    }
}
