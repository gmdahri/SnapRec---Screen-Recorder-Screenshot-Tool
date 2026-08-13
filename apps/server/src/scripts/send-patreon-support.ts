/**
 * Broadcast: ask users to support SnapRec on Patreon so it can stay free.
 *
 * Every user with an email is included EXCEPT internal addresses
 * (@codingcops.com by default — override with EXCLUDED_DOMAINS).
 *
 * Usage:
 *   cd apps/server && npx ts-node src/scripts/send-patreon-support.ts
 *
 * Dry run (no sends, prints the recipient list):
 *   DRY_RUN=1 npx ts-node src/scripts/send-patreon-support.ts
 *
 * Test send (one inbox only):
 *   TEST_EMAIL=you@example.com npx ts-node src/scripts/send-patreon-support.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();
// Merge apps/web/.env so vars set only there still apply (does not override server keys already set).
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
    getPatreonSupportEmailHtml,
    getPatreonSupportPlainHtml,
} from '../mail/templates/patreon-support';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SnapRec <onboarding@resend.dev>';
const REPLY_TO = process.env.FOUNDER_REPLY_TO || FROM_EMAIL;
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const DELAY_BETWEEN_EMAILS = Number(process.env.EMAIL_DELAY_MS) || 600;
const TEST_EMAIL_RAW = process.env.TEST_EMAIL?.trim();
// 'plain' = founder-style prose, 'rich' = the branded card layout. Defaults to plain
// because Gmail files the rich version under Promotions, where a donation ask goes unread.
const EMAIL_STYLE = (process.env.EMAIL_STYLE || 'plain').toLowerCase();

// Must be an address that actually receives mail. Defaults to the reply-to rather than
// inventing unsubscribe@, which has no Cloudflare Email Routing rule and would bounce.
const UNSUBSCRIBE_EMAIL = process.env.UNSUBSCRIBE_EMAIL || REPLY_TO.replace(/.*<|>.*/g, '');

/** Internal domains that must never receive the broadcast. */
const EXCLUDED_DOMAINS = (process.env.EXCLUDED_DOMAINS || 'codingcops.com')
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

function domainOf(email: string): string {
    return email.split('@').pop()?.toLowerCase() ?? '';
}

function isExcluded(email: string): boolean {
    const domain = domainOf(email);
    return EXCLUDED_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`));
}

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
    console.log(`🚫 Excluding domains: ${EXCLUDED_DOMAINS.map(d => '@' + d).join(', ')}`);

    const userRepo = dataSource.getRepository(User);
    const users = await userRepo.find();

    type Recipient = { email: string; fullName?: string };
    let recipients: Recipient[];

    if (TEST_EMAIL_RAW) {
        const normalized = TEST_EMAIL_RAW.toLowerCase();
        const match = users.find(u => u.email && u.email.toLowerCase() === normalized);
        recipients = [{ email: TEST_EMAIL_RAW, fullName: match?.fullName ?? undefined }];
        console.log(`🧪 TEST_EMAIL — sending only to <${TEST_EMAIL_RAW}> (exclusion list ignored)`);
        if (match) console.log(`   (matched DB user: ${match.fullName || 'no name'})`);
        else console.log('   (not in DB — generic greeting)');
    } else {
        // De-duplicate by lowercased email so a user with two rows isn't emailed twice.
        const seen = new Set<string>();
        let skippedInternal = 0;
        let skippedNoEmail = 0;
        recipients = [];

        for (const u of users) {
            if (!u.email) {
                skippedNoEmail++;
                continue;
            }
            const key = u.email.toLowerCase();
            if (isExcluded(key)) {
                skippedInternal++;
                continue;
            }
            if (seen.has(key)) continue;
            seen.add(key);
            recipients.push({ email: u.email, fullName: u.fullName ?? undefined });
        }

        console.log(
            `   skipped: ${skippedInternal} internal, ${skippedNoEmail} without an email address`,
        );
    }

    console.log(`📧 ${recipients.length} recipient(s)${TEST_EMAIL_RAW ? '' : ` (of ${users.length} users)`}`);
    console.log(`🗄️  DB: ${process.env.DB_USERNAME}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
    console.log(`🎨 Style: ${EMAIL_STYLE}`);
    console.log(DRY_RUN ? '🔶 DRY RUN — no emails will be sent\n' : '📤 LIVE SEND\n');

    // A broadcast that finds almost no one usually means the wrong database, not a small
    // user base. Refuse to send silently; MIN_RECIPIENTS=1 overrides once verified.
    const MIN_RECIPIENTS = Number(process.env.MIN_RECIPIENTS ?? 10);
    if (!TEST_EMAIL_RAW && !DRY_RUN && recipients.length < MIN_RECIPIENTS) {
        console.error(
            `\n❌ Only ${recipients.length} recipient(s) found, below MIN_RECIPIENTS=${MIN_RECIPIENTS}.\n` +
            `   Check that DB_* in .env points at the production database.\n` +
            `   To send anyway: MIN_RECIPIENTS=1 npm run script:email-patreon-support`,
        );
        await dataSource.destroy();
        process.exit(1);
    }

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

    // No emoji in the plain variant either — it reads as campaign mail to Gmail's classifier.
    const subject = EMAIL_STYLE === 'plain'
        ? 'A small ask about SnapRec'
        : 'Help us keep SnapRec free ❤️';

    for (const user of recipients) {
        const html = EMAIL_STYLE === 'plain'
            ? getPatreonSupportPlainHtml(user.fullName)
            : getPatreonSupportEmailHtml(user.fullName);

        if (DRY_RUN) {
            console.log(`  [dry-run] would send to ${user.email}`);
            sent++;
            continue;
        }

        try {
            const { data, error } = await resend!.emails.send({
                from: FROM_EMAIL,
                to: user.email,
                subject,
                replyTo: REPLY_TO,
                html,
                // Bulk mail without these lands in Gmail's spam/Promotions far more often,
                // and an opt-out path is required for commercial email (CAN-SPAM/GDPR).
                // mailto: needs no backend endpoint and Gmail honours it as one-click.
                headers: {
                    'List-Unsubscribe': `<mailto:${UNSUBSCRIBE_EMAIL}?subject=unsubscribe>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                },
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
