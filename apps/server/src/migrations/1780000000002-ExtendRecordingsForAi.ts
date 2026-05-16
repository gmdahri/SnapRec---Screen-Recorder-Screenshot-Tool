import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendRecordingsForAi1780000000002 implements MigrationInterface {
  name = 'ExtendRecordingsForAi1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sr_recordings"
        ADD COLUMN "durationSec" integer,
        ADD COLUMN "transcriptStatus" character varying NOT NULL DEFAULT 'none',
        ADD COLUMN "summaryStatus" character varying NOT NULL DEFAULT 'none',
        ADD COLUMN "transcriptFailReason" character varying
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sr_recordings_transcriptStatus" ON "sr_recordings" ("transcriptStatus")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_sr_recordings_transcriptStatus"`);
    await queryRunner.query(`
      ALTER TABLE "sr_recordings"
        DROP COLUMN "durationSec",
        DROP COLUMN "transcriptStatus",
        DROP COLUMN "summaryStatus",
        DROP COLUMN "transcriptFailReason"
    `);
  }
}
