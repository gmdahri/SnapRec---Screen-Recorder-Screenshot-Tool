import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUploadGrants1788652800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE sr_upload_grants (
      key varchar PRIMARY KEY, principal varchar NOT NULL, "ipHash" varchar NOT NULL,
      "sizeBytes" bigint NOT NULL CHECK ("sizeBytes">0), "contentType" varchar NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX ON sr_upload_grants (principal,"createdAt")');
    await q.query('CREATE INDEX ON sr_upload_grants ("ipHash","createdAt")');
    await q.query(`CREATE TABLE sr_qualified_views (
      "recordingId" uuid NOT NULL REFERENCES sr_recordings(id) ON DELETE CASCADE,
      "sessionId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("recordingId","sessionId")
    )`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE sr_qualified_views');
    await q.query('DROP TABLE sr_upload_grants');
  }
}
