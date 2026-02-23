/**
 * One-time script to send the personal founder welcome email
 * to all existing users who have an email address.
 *
 * Usage:
 *   npx ts-node src/scripts/send-founder-welcome.ts
 *
 * Make sure your .env has RESEND_API_KEY set.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Resend } from 'resend';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Reaction } from '../recordings/entities/reaction.entity';
import { Comment } from '../recordings/entities/comment.entity';
import { getFounderWelcomeEmailHtml } from '../mail/templates/founder-welcome';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SnapRec <onboarding@resend.dev>';
const REPLY_TO = process.env.FOUNDER_REPLY_TO || FROM_EMAIL;

// Delay between emails to respect rate limits (ms)
const DELAY_BETWEEN_EMAILS = 500;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (!RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY is not set in .env');
        process.exit(1);
    }

    const resend = new Resend(RESEND_API_KEY);

    // Connect to database
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Recording, Reaction, Comment],
        ssl: { rejectUnauthorized: false },
    });

    await dataSource.initialize();
    console.log('✅ Connected to database');

    // Fetch all users with email addresses
    const userRepo = dataSource.getRepository(User);
    const users = await userRepo.find();
    const usersWithEmail = users.filter(u => u.email);

    console.log(`📧 Found ${usersWithEmail.length} user(s) with email addresses (out of ${users.length} total)\n`);

    if (usersWithEmail.length === 0) {
        console.log('No users with email addresses found. Exiting.');
        await dataSource.destroy();
        return;
    }

    // Preview
    console.log('Users to email:');
    usersWithEmail.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.fullName || '(no name)'} <${u.email}>`);
    });
    console.log('');

    // Send emails
    let sent = 0;
    let failed = 0;

    for (const user of usersWithEmail) {
        try {
            const { data, error } = await resend.emails.send({
                from: FROM_EMAIL,
                to: user.email,
                subject: 'Hey from SnapRec 👋',
                replyTo: REPLY_TO,
                html: getFounderWelcomeEmailHtml(user.fullName),
            });

            if (error) {
                console.error(`  ❌ Failed: ${user.email} — ${JSON.stringify(error)}`);
                failed++;
            } else {
                console.log(`  ✅ Sent to ${user.email} (id: ${data?.id})`);
                sent++;
            }
        } catch (err) {
            console.error(`  ❌ Exception for ${user.email}:`, err);
            failed++;
        }

        // Rate limiting
        await sleep(DELAY_BETWEEN_EMAILS);
    }

    console.log(`\n📊 Done! Sent: ${sent}, Failed: ${failed}`);
    await dataSource.destroy();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
