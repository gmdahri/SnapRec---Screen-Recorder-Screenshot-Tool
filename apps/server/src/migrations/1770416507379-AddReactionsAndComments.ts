import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReactionsAndComments1770416507379 implements MigrationInterface {
    name = 'AddReactionsAndComments1770416507379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."sr_reactions_type_enum" AS ENUM('like', 'love', 'celebrate', 'insightful', 'curious')`);
        await queryRunner.query(`CREATE TABLE "sr_reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."sr_reactions_type_enum" NOT NULL DEFAULT 'like', "guestId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "recordingId" uuid, "userId" uuid, CONSTRAINT "PK_90095c53be42725489be29835b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sr_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "guestId" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "recordingId" uuid, "userId" uuid, CONSTRAINT "PK_984d9dfbad43208ec5ca247a995" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "views" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "description" character varying`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "location" character varying`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" ADD CONSTRAINT "FK_5222e1bde76b3396cee7bfa8840" FOREIGN KEY ("recordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" ADD CONSTRAINT "FK_0633a025a637f869316d576ddc4" FOREIGN KEY ("userId") REFERENCES "sr_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sr_comments" ADD CONSTRAINT "FK_93716bd9148baab51f727e86bc7" FOREIGN KEY ("recordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sr_comments" ADD CONSTRAINT "FK_3e83a71d2ebe0d08e7623d8d44f" FOREIGN KEY ("userId") REFERENCES "sr_users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sr_comments" DROP CONSTRAINT "FK_3e83a71d2ebe0d08e7623d8d44f"`);
        await queryRunner.query(`ALTER TABLE "sr_comments" DROP CONSTRAINT "FK_93716bd9148baab51f727e86bc7"`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" DROP CONSTRAINT "FK_0633a025a637f869316d576ddc4"`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" DROP CONSTRAINT "FK_5222e1bde76b3396cee7bfa8840"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "views"`);
        await queryRunner.query(`DROP TABLE "sr_comments"`);
        await queryRunner.query(`DROP TABLE "sr_reactions"`);
        await queryRunner.query(`DROP TYPE "public"."sr_reactions_type_enum"`);
    }

}
