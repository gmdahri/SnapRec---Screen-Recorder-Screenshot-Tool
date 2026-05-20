import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the two core tables that pre-dated the migration system.
// Must run before all other migrations.
export class CreateBaseTables1760000000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sr_users" (
                "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
                "supabaseId"  varchar     UNIQUE,
                "email"       varchar     UNIQUE,
                "fullName"    varchar,
                "avatarUrl"   varchar,
                "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sr_users" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."sr_recordings_type_enum" AS ENUM('video', 'screenshot');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        `);

        // Only the columns that existed before AddReactionsAndComments migration.
        // views/description/location/timestamptz are added by subsequent migrations.
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sr_recordings" (
                "id"            uuid      NOT NULL DEFAULT gen_random_uuid(),
                "title"         varchar   NOT NULL,
                "fileUrl"       varchar   NOT NULL,
                "thumbnailUrl"  varchar,
                "type"          "public"."sr_recordings_type_enum" NOT NULL,
                "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP NOT NULL DEFAULT now(),
                "userId"        uuid,
                CONSTRAINT "PK_sr_recordings" PRIMARY KEY ("id"),
                CONSTRAINT "FK_recording_user" FOREIGN KEY ("userId")
                    REFERENCES "sr_users"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sr_recordings_userId" ON "sr_recordings" ("userId")
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "sr_recordings"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."sr_recordings_type_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sr_users"`);
    }
}
