/** Lists video recordings whose stored file does not start with the WebM
 * header (1a45dfa3): the files extension v2.0.9 uploaded without their first
 * chunk. Read-only.
 *
 *   npm run script:check-webm-headers                                # since 2026-10-11 18:30 UTC
 *   SINCE=2026-10-01T00:00:00Z npm run script:check-webm-headers
 *
 * Connects with DATABASE_URL if set, otherwise DB_HOST/DB_PORT/DB_USERNAME/
 * DB_PASSWORD/DB_NAME, and R2 with the R2_* variables, all from .env.
 *
 * Read-only by construction: the database session defaults to read-only
 * transactions and the one SELECT runs inside BEGIN READ ONLY ... ROLLBACK;
 * R2 is only read, four bytes per file, by a ranged GET (StorageService's
 * readHead, the same read upload/complete uses). Prints counts and, for each
 * file that fails, the recording id and created time — never a key, URL,
 * title or anyone's details. */
// @ts-ignore -- pg ships no types; main.ts imports it the same way
import { Client } from 'pg';
import { StorageService } from '../storage/storage.service';

export const DEFAULT_SINCE = '2026-10-11T18:30:00Z';
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export type Status = 'ok' | 'no_header' | 'not_webm' | 'missing' | 'unreadable' | 'not_a_key';
export type Row = { id: string; fileUrl: string; createdAt: Date };
type Head = { contentType?: string; bytes: Uint8Array };

/** One file's verdict, by the same rule as upload/complete: only video/webm
 * is judged. */
export async function checkOne(fileUrl: string, readHead: (key: string, n: number) => Promise<Head>): Promise<Status> {
    if (!fileUrl || fileUrl.includes('://')) return 'not_a_key';
    let head: Head;
    try {
        head = await readHead(fileUrl, EBML_MAGIC.length);
    } catch (e: any) {
        const status = e?.$metadata?.httpStatusCode;
        return status === 404 || e?.name === 'NoSuchKey' || e?.name === 'NotFound' ? 'missing' : 'unreadable';
    }
    if (!(head.contentType ?? '').toLowerCase().startsWith('video/webm')) return 'not_webm';
    return Buffer.from(head.bytes).equals(EBML_MAGIC) ? 'ok' : 'no_header';
}

export async function checkAll(rows: Row[], readHead: (key: string, n: number) => Promise<Head>, concurrency = 8) {
    const results: { row: Row; status: Status }[] = new Array(rows.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
        while (next < rows.length) {
            const i = next++;
            results[i] = { row: rows[i], status: await checkOne(rows[i].fileUrl, readHead) };
        }
    }));
    return results;
}

/** Counts, then ids and created times for everything that is not ok. */
export function report(results: { row: Row; status: Status }[], since: string): string {
    const order: Status[] = ['no_header', 'missing', 'unreadable', 'not_a_key', 'not_webm', 'ok'];
    const count = (s: Status) => results.filter((r) => r.status === s).length;
    const lines = [
        `Video recordings created since ${since}: ${results.length}`,
        ...order.map((s) => `  ${s.padEnd(10)} ${count(s)}`),
    ];
    for (const s of ['no_header', 'missing', 'unreadable', 'not_a_key'] as Status[]) {
        const hits = results.filter((r) => r.status === s);
        if (!hits.length) continue;
        lines.push('', `${s}:`);
        for (const { row } of hits) lines.push(`  ${row.id}  ${new Date(row.createdAt).toISOString()}`);
    }
    return lines.join('\n');
}

async function main() {
    const since = process.env.SINCE || DEFAULT_SINCE;
    if (Number.isNaN(Date.parse(since))) {
        console.error('SINCE is not a date');
        process.exit(2);
    }
    const ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };
    const readOnly = '-c default_transaction_read_only=on';
    const db = new Client(process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl, options: readOnly }
        : {
            host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432', 10),
            user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
            ssl, options: readOnly,
        });
    await db.connect();
    let rows: Row[];
    try {
        await db.query('BEGIN READ ONLY');
        ({ rows } = await db.query(
            `SELECT id, "fileUrl", "createdAt" FROM sr_recordings
             WHERE type = 'video' AND "createdAt" >= $1 ORDER BY "createdAt"`, [since]));
    } finally {
        await db.query('ROLLBACK').catch(() => undefined);
        await db.end();
    }

    const storage = new StorageService({ get: (k: string) => process.env[k] } as any);
    const results = await checkAll(rows, (key, n) => storage.readHead(key, n));
    console.log(report(results, since));
}

if (require.main === module) {
    main().catch((e) => { console.error(`Failed: ${e?.name ?? "Error"}: ${e?.message ?? ""}`); process.exit(1); });
}
