import { MigrationInterface, QueryRunner } from 'typeorm';

/** When an unclaimed guest recording gets deleted.
 *
 * Streaming upload puts every capture on R2 as it is made, including those of
 * people who never sign in. Without a deadline those accumulate and bill
 * forever, so a guest upload gets one hour from the moment its upload
 * completes, and the sweep deletes the row and the R2 object together.
 *
 * Nullable, and NULL is the normal state: a signed-in recording never expires,
 * and claiming a guest recording clears the value. The index is therefore
 * partial — the sweep asks only "what is past due", and the overwhelming
 * majority of rows are not candidates at all.
 *
 * Timestamped after every migration already applied to the database rather
 * than after the newest file in this tree: the two have diverged, and TypeORM
 * orders by timestamp. */
export class AddRecordingExpiry1785000000000 implements MigrationInterface {
    name = 'AddRecordingExpiry1785000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "sr_recordings" ADD "expiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(
            `CREATE INDEX "IDX_sr_recordings_expiresAt" ON "sr_recordings" ("expiresAt") ` +
            `WHERE "expiresAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_sr_recordings_expiresAt"`);
        await queryRunner.query(`ALTER TABLE "sr_recordings" DROP COLUMN "expiresAt"`);
    }
}
