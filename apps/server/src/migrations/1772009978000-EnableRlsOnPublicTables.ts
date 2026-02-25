import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRlsOnPublicTables1772009978000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sr_users" ENABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "migrations" ENABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" ENABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" ENABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_comments" ENABLE ROW LEVEL SECURITY;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sr_users" DISABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "migrations" DISABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DISABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_reactions" DISABLE ROW LEVEL SECURITY;`);
        await queryRunner.query(`ALTER TABLE "sr_comments" DISABLE ROW LEVEL SECURITY;`);
    }
}
