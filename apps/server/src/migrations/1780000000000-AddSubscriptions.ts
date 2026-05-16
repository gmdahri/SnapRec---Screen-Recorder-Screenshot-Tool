import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptions1780000000000 implements MigrationInterface {
  name = 'AddSubscriptions1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."sr_subscriptions_plan_enum" AS ENUM('free', 'pro')
    `);
    await queryRunner.query(`
      CREATE TABLE "sr_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "stripeCustomerId" character varying,
        "stripeSubscriptionId" character varying,
        "plan" "public"."sr_subscriptions_plan_enum" NOT NULL DEFAULT 'free',
        "status" character varying NOT NULL DEFAULT 'inactive',
        "currentPeriodEnd" TIMESTAMP WITH TIME ZONE,
        "aiMinutesUsedThisCycle" integer NOT NULL DEFAULT 0,
        "aiMinutesIncluded" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sr_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sr_subscriptions_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_subscription_user" FOREIGN KEY ("userId") REFERENCES "sr_users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sr_subscriptions_stripeCustomerId" ON "sr_subscriptions" ("stripeCustomerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sr_subscriptions_stripeSubscriptionId" ON "sr_subscriptions" ("stripeSubscriptionId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_sr_subscriptions_stripeSubscriptionId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sr_subscriptions_stripeCustomerId"`);
    await queryRunner.query(`DROP TABLE "sr_subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."sr_subscriptions_plan_enum"`);
  }
}
