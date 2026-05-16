import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptsAndSummaries1780000000001 implements MigrationInterface {
  name = 'AddTranscriptsAndSummaries1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sr_transcripts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recordingId" uuid NOT NULL,
        "language" character varying,
        "durationSec" integer,
        "segmentsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "rawProviderResponse" jsonb,
        "model" character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sr_transcripts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sr_transcripts_recordingId" UNIQUE ("recordingId"),
        CONSTRAINT "FK_transcript_recording" FOREIGN KEY ("recordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sr_summaries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recordingId" uuid NOT NULL,
        "tldr" text NOT NULL DEFAULT '',
        "bulletsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "actionItemsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "chaptersJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "keyDecisionsJson" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "model" character varying NOT NULL,
        "promptVersion" character varying NOT NULL DEFAULT 'v1',
        "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sr_summaries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sr_summaries_recordingId" UNIQUE ("recordingId"),
        CONSTRAINT "FK_summary_recording" FOREIGN KEY ("recordingId") REFERENCES "sr_recordings"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sr_summaries"`);
    await queryRunner.query(`DROP TABLE "sr_transcripts"`);
  }
}
