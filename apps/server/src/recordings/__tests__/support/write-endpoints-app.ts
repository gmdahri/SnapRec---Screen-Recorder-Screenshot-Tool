import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import * as http from 'http';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { RecordingsController } from '../../recordings.controller';
import { RecordingsService } from '../../recordings.service';
import { StorageService } from '../../../storage/storage.service';
import { UsersService } from '../../../users/users.service';
import { JwtStrategy } from '../../../auth/jwt.strategy';
import { Recording } from '../../entities/recording.entity';
import { Reaction } from '../../entities/reaction.entity';
import { Comment } from '../../entities/comment.entity';
import { RecordingView } from '../../entities/recording-view.entity';

/** The recordings API as an attacker meets it.
 *
 * Real controller, real RecordingsService, real OptionalJwtAuthGuard and
 * JwtAuthGuard, the real JWKS strategy (against a local key) and the same
 * ValidationPipe main.ts installs. What is faked is only what sits outside
 * this service: Postgres, as tables with TypeORM's semantics (save() upserts,
 * insert() refuses a duplicate key), and R2, as a bucket of keys. */

const R2 = 'https://acct.r2.cloudflarestorage.com/snaprec';

/** Matches a TypeORM `where` against a row: plain values, nested relation
 * objects ({ recording: { id } }) and the In/LessThan operators. */
function matches(row: any, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
        const actual = row?.[k];
        if (v instanceof FindOperator) {
            const op = (v as any).type ?? (v as any)._type;
            const value = (v as any).value ?? (v as any)._value;
            if (op === 'in') return (value as any[]).includes(actual);
            if (op === 'isNull') return actual === null || actual === undefined;
            if (op === 'lessThan') return actual != null && actual < value;
            throw new Error(`fake repo: unsupported operator ${op}`);
        }
        if (v && typeof v === 'object' && !(v instanceof Date)) return matches(actual, v);
        return actual === v;
    });
}

function table(name: string, db: Db, resolveUser: (id: string) => any = () => undefined) {
    const rows = new Map<string, any>();
    const defined = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const withRelations = (row: any, relations: string[] = []) => {
        const out = { ...row };
        // As TypeORM loads them: a child's own `recording` relation is not
        // loaded unless asked for, so it is not on the child.
        const children = (t: ReturnType<typeof table>) => [...t.rows.values()]
            .filter((c) => c.recording?.id === row.id)
            .map(({ recording: _parent, ...c }) => c);
        if (name === 'recordings') {
            if (relations.includes('reactions')) out.reactions = children(db.reactions);
            if (relations.includes('comments')) out.comments = children(db.comments);
        }
        return out;
    };
    // One-to-many collections are not columns: TypeORM does not store a
    // loaded `comments` or `reactions` array on the row when it saves it.
    const columnsOf = (entity: any) => {
        const { reactions: _r, comments: _c, ...columns } = defined(entity);
        return name === 'recordings' ? columns : defined(entity);
    };
    const put = (entity: any) => {
        const id = entity.id ?? crypto.randomUUID();
        const merged = { createdAt: new Date(), ...(rows.get(id) ?? {}), ...columnsOf(entity), id };
        rows.set(id, merged);
        Object.assign(entity, { id });
        return merged;
    };
    return {
        rows,
        create: (o: any) => ({ ...o }),
        findOne: async ({ where, relations }: any = {}) => {
            const row = [...rows.values()].find((r) => matches(r, where));
            return row ? withRelations(row, relations) : null;
        },
        find: async ({ where, relations }: any = {}) =>
            [...rows.values()].filter((r) => matches(r, where)).map((r) => withRelations(r, relations)),
        count: async ({ where }: any = {}) => [...rows.values()].filter((r) => matches(r, where)).length,
        insert: async (entity: any) => {
            if (entity.id && rows.has(entity.id)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
            const row = put(entity);
            return { identifiers: [{ id: row.id }], generatedMaps: [{ id: row.id }], raw: [] };
        },
        // TypeORM semantics: an existing id is UPDATEd.
        save: async (entity: any) => (Array.isArray(entity) ? entity.map(put) : put(entity)),
        remove: async (entity: any) => {
            for (const e of Array.isArray(entity) ? entity : [entity]) rows.delete(e.id);
            return entity;
        },
        // UPDATE … WHERE <criteria>: only the matching rows, only the given
        // columns. A relation set by id reads back as the full row, as it
        // does from the database.
        update: async (criteria: any, patch: any) => {
            const where = typeof criteria === 'string' ? { id: criteria } : criteria;
            const hits = [...rows.values()].filter((r) => matches(r, where));
            const resolved = { ...patch };
            if (resolved.user?.id && !resolved.user.supabaseId) resolved.user = resolveUser(resolved.user.id) ?? resolved.user;
            for (const r of hits) Object.assign(r, resolved);
            return { affected: hits.length, raw: [], generatedMaps: [] };
        },
        increment: async (criteria: any, column: string, by: number) => {
            const hits = [...rows.values()].filter((r) => matches(r, criteria));
            for (const r of hits) r[column] = (r[column] ?? 0) + by;
            return { affected: hits.length, raw: [], generatedMaps: [] };
        },
        delete: async (criteria: any) => {
            const where = typeof criteria === 'string' ? { id: criteria } : criteria;
            const hits = [...rows.values()].filter((r) => matches(r, where));
            for (const r of hits) rows.delete(r.id);
            return { affected: hits.length, raw: [] };
        },
    };
}

type Db = { recordings: ReturnType<typeof table>; reactions: ReturnType<typeof table>; comments: ReturnType<typeof table>; views: ReturnType<typeof table> };

/** 'sb-owner' -> 'Owner Person': a name that does not contain the id. */
export const displayName = (supabaseId: string) =>
    `${supabaseId.replace(/^sb-/, '').replace(/^./, (c) => c.toUpperCase())} Person`;
export const avatarFor = (supabaseId: string) => `https://avatars.test/${Buffer.from(supabaseId).toString('hex')}.png`;

/** R2 as a set of keys. URLs are shaped like real presigned ones — the key is
 * readable in the path — because that is what leaks a key to an attacker. */
function bucket() {
    const objects = new Map<string, string>();
    const uploads = new Map<string, string>(); // uploadId -> key
    const signedPuts: string[] = [];
    return {
        objects, uploads, signedPuts,
        async getUploadPresignedUrl(key: string) { signedPuts.push(key); return `${R2}/${key}?X-Amz-Signature=put`; },
        async createMultipartUpload(key: string) { const id = `mp-${uploads.size + 1}`; uploads.set(id, key); return id; },
        async getUploadPartUrl(key: string, uploadId: string, n: number) { return `${R2}/${key}?uploadId=${uploadId}&partNumber=${n}`; },
        async completeMultipartUpload(key: string, uploadId: string) {
            if (uploads.get(uploadId) !== key) throw Object.assign(new Error('NoSuchUpload'), { name: 'NoSuchUpload' });
            uploads.delete(uploadId);
            objects.set(key, `multipart:${uploadId}`);
        },
        async abortMultipartUpload(key: string, uploadId: string) { uploads.delete(uploadId); },
        async getDownloadUrl(key: string) { return `${R2}/${key}?X-Amz-Signature=get`; },
        async checkFileExists(key: string) { return objects.has(key); },
        async deleteObject(key: string) { objects.delete(key); },
    };
}

export async function writeEndpointsApp() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwks = http.createServer((_, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig' }] }));
    });
    await new Promise<void>((r) => jwks.listen(0, r));
    process.env.SUPABASE_URL = `http://127.0.0.1:${(jwks.address() as any).port}`;

    const db = {} as Db;
    const usersById = new Map<string, any>();
    db.recordings = table('recordings', db, (id) => usersById.get(id));
    db.reactions = table('reactions', db);
    db.comments = table('comments', db);
    db.views = table('views', db);
    const r2 = bucket();
    // Full rows, as UsersService returns them: the internal id, the auth id,
    // the email and the display fields all travel with every relation.
    const users = {
        findOrCreateBySupabaseId: async (supabaseId: string) => remember({
            id: `row-${supabaseId}`, supabaseId, email: `${supabaseId}@example.com`,
            // Display fields deliberately do not contain the ids, so a test can
            // tell a leaked id from a legitimately shown name.
            fullName: displayName(supabaseId), avatarUrl: avatarFor(supabaseId),
            createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
        }),
    };
    function remember(user: any) { usersById.set(user.id, user); return user; }

    const mod = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), PassportModule],
        controllers: [RecordingsController],
        providers: [RecordingsService, JwtStrategy,
            { provide: StorageService, useValue: r2 },
            { provide: UsersService, useValue: users },
            { provide: getRepositoryToken(Recording), useValue: db.recordings },
            { provide: getRepositoryToken(Reaction), useValue: db.reactions },
            { provide: getRepositoryToken(Comment), useValue: db.comments },
            { provide: getRepositoryToken(RecordingView), useValue: db.views }],
    }).compile();
    const app: INestApplication = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const token = (sub: string, expOffsetSec = 3600) => jwt.sign(
        { sub, email: `${sub}@example.com`, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + expOffsetSec },
        privateKey.export({ type: 'pkcs8', format: 'pem' }), { algorithm: 'ES256', keyid: 'k1' });

    const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object, bearer?: string) => {
        const r = request(app.getHttpServer())[method](path);
        if (bearer) r.set('Authorization', `Bearer ${bearer}`);
        return body ? r.send(body) : r;
    };

    /** A recording as its owner leaves it: registered and its file on R2. */
    async function victim({ owner, guestId, key = `video-${crypto.randomUUID()}-1.webm` }: { owner?: string; guestId?: string; key?: string }) {
        r2.objects.set(key, 'victim');
        const res = await call('post', '/recordings',
            { id: crypto.randomUUID(), title: 'Quarterly review', fileUrl: key, type: 'video', guestId },
            owner ? token(owner) : undefined);
        if (res.status !== 201) throw new Error(`victim setup failed: ${res.status} ${JSON.stringify(res.body)}`);
        return { id: res.body.id as string, key };
    }

    /** What anyone holding the share link can learn: the key is in the signed
     * URL's path (or is the fileUrl itself while the file is processing). */
    async function keyFromShareLink(id: string) {
        const { body } = await call('get', `/recordings/${id}`);
        const fileUrl: string = body.fileUrl;
        return fileUrl.startsWith(R2) ? decodeURIComponent(new URL(fileUrl).pathname.split('/').slice(2).join('/')) : fileUrl;
    }

    return {
        app, db, r2, token, call, victim, keyFromShareLink,
        close: async () => { await app.close(); jwks.close(); },
    };
}
