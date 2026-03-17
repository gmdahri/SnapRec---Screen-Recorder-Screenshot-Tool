import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoProjects1773000000000 implements MigrationInterface {
  name = 'VideoProjects1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sr_video_projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "sourceRecordingId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "timelineJson" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sr_video_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_video_project_user" FOREIGN KEY ("userId") REFERENCES "sr_users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_video_project_recording" FOREIGN KEY ("sourceRecordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sr_video_projects_userId" ON "sr_video_projects" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sr_video_projects_sourceRecordingId" ON "sr_video_projects" ("sourceRecordingId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_sr_video_projects_sourceRecordingId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sr_video_projects_userId"`);
    await queryRunner.query(`DROP TABLE "sr_video_projects"`);
  }
}
