/**
 * Broadcast: Video Editor launches (set LAUNCH_DATE_TEXT + dry-run before send).
 *
 * Usage:
 *   cd apps/server && npx ts-node src/scripts/send-video-editor-launch.ts
 *
 * Dry run (no sends):
 *   DRY_RUN=1 npx ts-node src/scripts/send-video-editor-launch.ts
 *
 * Exact Tuesday copy:
 *   LAUNCH_DATE_TEXT="Tuesday, March 18" npx ts-node src/scripts/send-video-editor-launch.ts
 *
 * Test send (one inbox only):
 *   TEST_EMAIL=ghulammuhammadddahri@gmail.com npx ts-node src/scripts/send-video-editor-launch.ts
 *
 * Env: RESEND_API_KEY, DB_*, RESEND_FROM_EMAIL, FOUNDER_REPLY_TO (optional)
 * Optional: LAUNCH_DATE_TEXT (default "this Tuesday")
 * (Email has no editor URL until the feature is deployed.)
 * Optional: TEST_EMAIL — send only to this address (still uses DB to resolve name if user exists)
 * Optional: EXTENSION_URL — also read from apps/web/.env if you keep the store link next to the web app.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();
// Merge apps/web/.env so EXTENSION_URL (and similar) set only there still apply (does not override server keys already set).
dotenv.config({
    path: path.join(__dirname, '../../../web/.env'),
    override: false,
});

import { DataSource } from 'typeorm';
import { Resend } from 'resend';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Reaction } from '../recordings/entities/reaction.entity';
import { Comment } from '../recordings/entities/comment.entity';
import {
    getVideoEditorLaunchEmailHtml,
    SNAPREC_CHROME_STORE_URL,
} from '../mail/templates/video-editor-launch';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SnapRec <onboarding@resend.dev>';
const REPLY_TO = process.env.FOUNDER_REPLY_TO || FROM_EMAIL;
const LAUNCH_DATE_TEXT = process.env.LAUNCH_DATE_TEXT || 'this Tuesday';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const DELAY_BETWEEN_EMAILS = Number(process.env.EMAIL_DELAY_MS) || 600;
const TEST_EMAIL_RAW = process.env.TEST_EMAIL?.trim();

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (!DRY_RUN && !RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY is not set (or set DRY_RUN=1 to preview only)');
        process.exit(1);
    }

    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Recording, Reaction, Comment],
        ssl: { rejectUnauthorized: false },
    });

    await dataSource.initialize();
    console.log('✅ Connected to database');

    const userRepo = dataSource.getRepository(User);
    const users = await userRepo.find();
    const usersWithEmail = users.filter(u => u.email);

    type Recipient = { email: string; fullName?: string };
    let recipients: Recipient[];

    if (TEST_EMAIL_RAW) {
        const normalized = TEST_EMAIL_RAW.toLowerCase();
        const match = users.find(u => u.email && u.email.toLowerCase() === normalized);
        recipients = [{ email: TEST_EMAIL_RAW, fullName: match?.fullName ?? undefined }];
        console.log(`🧪 TEST_EMAIL — sending only to <${TEST_EMAIL_RAW}>`);
        if (match) console.log(`   (matched DB user: ${match.fullName || 'no name'})`);
        else console.log('   (not in DB — generic greeting)');
    } else {
        recipients = usersWithEmail.map(u => ({ email: u.email!, fullName: u.fullName ?? undefined }));
    }

    console.log(`📧 ${recipients.length} recipient(s)${TEST_EMAIL_RAW ? '' : ` (of ${users.length} users)`}`);
    console.log(`📅 Launch copy: "${LAUNCH_DATE_TEXT}" (no product link in email)`);
    console.log(DRY_RUN ? '🔶 DRY RUN — no emails will be sent\n' : '📤 LIVE SEND\n');

    if (recipients.length === 0) {
        console.log('No recipients. Set TEST_EMAIL or ensure users have emails.');
        await dataSource.destroy();
        return;
    }

    recipients.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.fullName || '(no name)'} <${u.email}>`);
    });
    console.log('');

    let sent = 0;
    let failed = 0;

    const subject = `SnapRec Video Editor — launching ${LAUNCH_DATE_TEXT} 🎬`;

    for (const user of recipients) {
        const html = getVideoEditorLaunchEmailHtml(user.fullName, {
            launchDateText: LAUNCH_DATE_TEXT,
        });

        if (DRY_RUN) {
            console.log(`  [dry-run] would send to ${user.email}`);
            sent++;
            continue;
        }

        try {
            const { data, error } = await resend!.emails.send({
                from: FROM_EMAIL,
                to: user.email!,
                subject,
                replyTo: REPLY_TO,
                html,
            });

            if (error) {
                console.error(`  ❌ ${user.email} — ${JSON.stringify(error)}`);
                failed++;
            } else {
                console.log(`  ✅ ${user.email} (id: ${data?.id})`);
                sent++;
            }
        } catch (err) {
            console.error(`  ❌ ${user.email}`, err);
            failed++;
        }

        await sleep(DELAY_BETWEEN_EMAILS);
    }

    console.log(`\n📊 ${DRY_RUN ? 'Dry run' : 'Done'}: ${sent} ok, ${failed} failed`);
    await dataSource.destroy();
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
