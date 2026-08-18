/**
 * Backfill: mirror every SnapRec user into the Loops audience.
 *
 * New signups sync automatically via LoopsService. This script exists to
 * backfill users who registered before that hook, and to repair drift.
 *
 * Usage:
 *   cd apps/server && npm run script:sync-loops-contacts
 *
 * Dry run (no API calls, prints the mapped payloads):
 *   npm run script:sync-loops-contacts:dry
 *
 * Env: LOOPS_API_KEY, LOOPS_MAILING_LIST_ID, DB_*
 * Optional: DRY_RUN=1, LOOPS_MIN_CONTACTS (default 10), EXCLUDED_DOMAINS
 *           (default codingcops.com), LOOPS_DELAY_MS (default 150)
 *
 * Canary a small batch before a full run:
 *   LOOPS_LIMIT=5 npm run script:sync-loops-contacts
 */
import * as dotenv from 'dotenv';

dotenv.config();

import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { Reaction } from '../recordings/entities/reaction.entity';
import { Comment } from '../recordings/entities/comment.entity';
import { LoopsClient, LoopsApiError } from '../loops/loops.client';
import {
    LoopsContactSource,
    buildCreatePayload,
    parseExcludedDomains,
    selectSyncableUsers,
} from '../loops/loops.contacts';

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_MAILING_LIST_ID = process.env.LOOPS_MAILING_LIST_ID;
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const MIN_CONTACTS = Number(process.env.LOOPS_MIN_CONTACTS ?? 10);
// Loops allows 10 req/s per team; 150ms keeps a comfortable margin.
const DELAY_MS = Number(process.env.LOOPS_DELAY_MS) || 150;
// Sync only the first N contacts. Use for a canary batch before a full run —
// the guards below cannot protect against syncing the wrong audience wholesale.
const LIMIT = Number(process.env.LOOPS_LIMIT) || 0;

const excludedDomains = parseExcludedDomains(process.env.EXCLUDED_DOMAINS);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function main() {
    if (!DRY_RUN && (!LOOPS_API_KEY || !LOOPS_MAILING_LIST_ID)) {
        console.error('❌ LOOPS_API_KEY and LOOPS_MAILING_LIST_ID must be set (or use DRY_RUN=1)');
        process.exit(1);
    }

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
    console.log(`🗄️  DB: ${process.env.DB_USERNAME}@${process.env.DB_HOST}/${process.env.DB_NAME}`);
    console.log(`🚫 Excluding domains: ${excludedDomains.map(d => '@' + d).join(', ')}`);

    const users = await dataSource.getRepository(User).find();
    const allSyncable = selectSyncableUsers(users as LoopsContactSource[], excludedDomains);
    const syncable = LIMIT > 0 ? allSyncable.slice(0, LIMIT) : allSyncable;

    console.log(`👥 ${allSyncable.length} syncable contact(s) of ${users.length} users`);
    if (LIMIT > 0) {
        console.log(`✂️  LOOPS_LIMIT=${LIMIT} — syncing only the first ${syncable.length}`);
    }
    console.log(DRY_RUN ? '🔶 DRY RUN — no API calls will be made\n' : '📤 LIVE SYNC\n');

    // A sync that finds almost no one usually means the wrong database, not a
    // small user base. The local .env points at a small dev Supabase project.
    if (!DRY_RUN && allSyncable.length < MIN_CONTACTS) {
        console.error(
            `\n❌ Only ${allSyncable.length} contact(s) found, below LOOPS_MIN_CONTACTS=${MIN_CONTACTS}.\n` +
            `   Check that DB_* in .env points at the production database.\n` +
            `   To sync anyway: LOOPS_MIN_CONTACTS=1 npm run script:sync-loops-contacts`,
        );
        await dataSource.destroy();
        process.exit(1);
    }

    if (syncable.length === 0) {
        console.log('Nothing to sync.');
        await dataSource.destroy();
        return;
    }

    const client = DRY_RUN ? null : new LoopsClient(LOOPS_API_KEY!, LOOPS_MAILING_LIST_ID!);

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const user of syncable) {
        if (DRY_RUN) {
            console.log(
                `  [dry-run] ${user.email} → ${JSON.stringify(
                    buildCreatePayload(user, LOOPS_MAILING_LIST_ID ?? 'LIST_ID'),
                )}`,
            );
            continue;
        }

        try {
            const outcome = await client!.upsertContact(user);
            if (outcome === 'created') created++;
            else updated++;
            console.log(`  ✅ ${outcome.padEnd(7)} ${user.email}`);
        } catch (err) {
            failed++;
            const detail = err instanceof LoopsApiError ? `${err.status} ${err.message}` : String(err);
            console.error(`  ❌ ${user.email} — ${detail}`);
        }

        await sleep(DELAY_MS);
    }

    console.log(
        DRY_RUN
            ? `\n📊 Dry run: ${syncable.length} would be synced`
            : `\n📊 Done: ${created} created, ${updated} updated, ${failed} failed`,
    );

    await dataSource.destroy();
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
