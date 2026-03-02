/**
 * One-off script: delete ALL recordings from the database and their files from R2.
 * Use this to start fresh (e.g. after fixing video-undefined bugs) or for dev cleanup.
 *
 * Run from repo root: npm run script:wipe-recordings --workspace=apps/server
 * Or from apps/server: npx ts-node -r dotenv/config scripts/wipe-recordings.ts
 *
 * Requires .env with DB_* and R2_* variables.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Recording } from '../src/recordings/entities/recording.entity';
import { User } from '../src/users/entities/user.entity';
import { Reaction } from '../src/recordings/entities/reaction.entity';
import { Comment } from '../src/recordings/entities/comment.entity';

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

async function main() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Recording, Reaction, Comment],
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });

    await dataSource.initialize();
    const recordingRepo = dataSource.getRepository(Recording);

    const recordings = await recordingRepo.find({ select: ['id', 'fileUrl', 'title'] });
    const total = recordings.length;

    if (total === 0) {
        console.log('No recordings found. Exiting.');
        await dataSource.destroy();
        process.exit(0);
    }

    console.log(`Found ${total} recording(s). This will delete all DB rows and R2 files.`);
    console.log('Waiting 5 seconds. Press Ctrl+C to abort...');
    await new Promise((r) => setTimeout(r, 5000));

    let s3Client: S3Client | null = null;
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
        s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
            credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
        });
    } else {
        console.warn('R2 env vars missing. Skipping R2 file deletion (only DB rows will be removed).');
    }

    let deletedFiles = 0;
    let failedFiles = 0;

    for (const rec of recordings) {
        const key = rec.fileUrl;
        if (s3Client && key) {
            try {
                await s3Client.send(
                    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
                );
                deletedFiles++;
            } catch (e) {
                console.warn(`R2 delete failed for key "${key}":`, (e as Error).message);
                failedFiles++;
            }
        }
    }

    await recordingRepo.remove(recordings);
    console.log(`Deleted ${deletedFiles} file(s) from R2${failedFiles ? `, ${failedFiles} failed` : ''}.`);
    console.log(`Removed ${total} recording(s) from the database (reactions/comments cascaded).`);
    await dataSource.destroy();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
