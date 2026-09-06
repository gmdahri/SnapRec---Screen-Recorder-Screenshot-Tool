/** Dry-run by default. Only server-managed, unused uploads older than 48h. */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { StorageService } from '../storage/storage.service';
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const db = app.get(DataSource);
    const storage = app.get(StorageService);
    const apply = process.argv.includes('--apply');
    const rows = await db.query(`SELECT key FROM sr_upload_grants g
      WHERE "createdAt" < now()-interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM sr_recordings r WHERE r."fileUrl"=g.key)
      ORDER BY "createdAt" LIMIT 500`);
    console.log(`${apply ? 'Cleanup' : 'Dry run'}: ${rows.length} unused uploads`);
    for (const row of rows) {
      if (!apply) continue;
      await storage.deleteObject(row.key);
      await db.query('DELETE FROM sr_upload_grants WHERE key=$1', [row.key]);
    }
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
