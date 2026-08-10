import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets a comment be marked answered (P7 V3).
 *
 * A timestamp rather than a boolean: "when was this settled" answers questions
 * a flag cannot — ordering an activity feed, telling a reply from a stale
 * resolve, and reporting on how long questions sit unanswered. A boolean would
 * have to be widened into this later anyway.
 *
 * `resolvedByUserId` is nullable and NOT a foreign key cascade target on
 * delete — if the resolver's account goes away, the comment is still resolved;
 * only the attribution is lost. Guests cannot resolve at all, so there is no
 * guestId counterpart: there is no durable identity to authorise against, and
 * anyone with a share link would otherwise be able to close other people's
 * questions.
 *
 * Nothing is backfilled. Every existing comment is unresolved, which is true. */
export class AddCommentResolution1775000003000 implements MigrationInterface {
    name = 'AddCommentResolution1775000003000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP WITH TIME ZONE
        `);
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            ADD COLUMN IF NOT EXISTS "resolvedByUserId" uuid
        `);
        // The viewer's default filter is "unresolved first", which reads this
        // on every comment fetch for a recording.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sr_comments_resolvedAt"
            ON "sr_comments" ("resolvedAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sr_comments_resolvedAt"`);
        await queryRunner.query(`ALTER TABLE "sr_comments" DROP COLUMN IF EXISTS "resolvedByUserId"`);
        await queryRunner.query(`ALTER TABLE "sr_comments" DROP COLUMN IF EXISTS "resolvedAt"`);
    }
}
