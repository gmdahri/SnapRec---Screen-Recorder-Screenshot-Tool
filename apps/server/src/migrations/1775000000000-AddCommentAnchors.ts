import { MigrationInterface, QueryRunner } from 'typeorm';

/** Comment anchors for the redesigned share surfaces (P4, scenes C1 and C2).
 *
 * A video comment attaches to a moment; an image comment attaches to a place.
 * Both are nullable: a comment with no anchor is still valid — it is about the
 * capture as a whole, which is what every existing row is.
 *
 * Coordinates are NORMALISED (0–1), not pixels. The same screenshot renders at
 * different widths on desktop, tablet and mobile, and a pin must land on the
 * same feature at every size. */
export class AddCommentAnchors1775000000000 implements MigrationInterface {
    name = 'AddCommentAnchors1775000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            ADD COLUMN IF NOT EXISTS "timecodeMs" integer,
            ADD COLUMN IF NOT EXISTS "anchorX" double precision,
            ADD COLUMN IF NOT EXISTS "anchorY" double precision
        `);

        // A point anchor is meaningless outside the image.
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            ADD CONSTRAINT "CHK_comment_anchor_bounds"
            CHECK (
                ("anchorX" IS NULL OR ("anchorX" >= 0 AND "anchorX" <= 1))
                AND ("anchorY" IS NULL OR ("anchorY" >= 0 AND "anchorY" <= 1))
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            DROP CONSTRAINT IF EXISTS "CHK_comment_anchor_bounds"
        `);
        await queryRunner.query(`
            ALTER TABLE "sr_comments"
            DROP COLUMN IF EXISTS "timecodeMs",
            DROP COLUMN IF EXISTS "anchorX",
            DROP COLUMN IF EXISTS "anchorY"
        `);
    }
}
