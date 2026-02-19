import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1771519639252 implements MigrationInterface {
    name = 'AddIndexes1771519639252'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_5222e1bde76b3396cee7bfa884" ON "sr_reactions" ("recordingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0633a025a637f869316d576ddc" ON "sr_reactions" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_93716bd9148baab51f727e86bc" ON "sr_comments" ("recordingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3e83a71d2ebe0d08e7623d8d44" ON "sr_comments" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c590e34e103633a65c77efcd37" ON "sr_recordings" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c590e34e103633a65c77efcd37"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3e83a71d2ebe0d08e7623d8d44"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_93716bd9148baab51f727e86bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0633a025a637f869316d576ddc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5222e1bde76b3396cee7bfa884"`);
    }

}
