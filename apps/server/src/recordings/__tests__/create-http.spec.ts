import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as http from 'http';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { RecordingsController } from '../recordings.controller';
import { RecordingsService } from '../recordings.service';
import { StorageService } from '../../storage/storage.service';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { Recording } from '../entities/recording.entity';
import { Reaction } from '../entities/reaction.entity';
import { Comment } from '../entities/comment.entity';
import { RecordingView } from '../entities/recording-view.entity';

/** POST /recordings must create, never overwrite.
 *
 * It used to end in repository.save(), which TypeORM turns into an UPDATE when
 * the id already exists. Recording ids are not secret — every share link
 * carries one — so anyone could POST a victim's id with no token and a guestId,
 * and the row was rewritten as a guest upload: new fileUrl, and an expiresAt
 * one hour out, after which the sweep deleted the owner's recording and its
 * file.
 *
 * This runs the real controller, the real OptionalJwtAuthGuard and JWKS
 * strategy (against a local key), and the real ValidationPipe. Only the
 * database is faked, and the fake keeps Postgres's rules: save() upserts, as
 * TypeORM's does, and insert() refuses a duplicate primary key with 23505. */

const OWNER = 'sb-owner';
const STRANGER = 'sb-stranger';
const VICTIM_ID = '11111111-1111-4111-8111-111111111111';

function fakeDb() {
    const rows = new Map<string, any>();
    const defined = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const repo = {
        rows,
        findOne: async ({ where: { id } }: any) => (rows.has(id) ? structuredClone(rows.get(id)) : null),
        find: async ({ where: { fileUrl } }: any) => [...rows.values()].filter((r) => r.fileUrl === fileUrl),
        insert: async (entity: any) => {
            const id = entity.id ?? crypto.randomUUID();
            if (rows.has(id)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
            rows.set(id, { createdAt: new Date(), guestId: null, expiresAt: null, user: null, ...defined(entity), id });
            return { identifiers: [{ id }], generatedMaps: [{ id }], raw: [] };
        },
        // TypeORM semantics: an existing id is UPDATEd with every defined property.
        save: async (entity: any) => {
            const id = entity.id ?? crypto.randomUUID();
            const merged = { createdAt: new Date(), guestId: null, expiresAt: null, user: null, ...(rows.get(id) ?? {}), ...defined(entity), id };
            rows.set(id, merged);
            return structuredClone(merged);
        },
    };
    return repo;
}

describe('POST /recordings', () => {
    let app: INestApplication;
    let jwks: http.Server;
    let db: ReturnType<typeof fakeDb>;
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const token = (sub: string, expOffsetSec = 3600) => jwt.sign(
        { sub, email: `${sub}@example.com`, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + expOffsetSec },
        privateKey.export({ type: 'pkcs8', format: 'pem' }), { algorithm: 'ES256', keyid: 'k1' });

    beforeAll(async () => {
        jwks = http.createServer((_, res) => {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig' }] }));
        });
        await new Promise<void>((r) => jwks.listen(0, r));
        process.env.SUPABASE_URL = `http://127.0.0.1:${(jwks.address() as any).port}`;
    });
    afterAll(() => { jwks.close(); });

    beforeEach(async () => {
        db = fakeDb();
        const users = { findOrCreateBySupabaseId: async (supabaseId: string) => ({ id: `row-${supabaseId}`, supabaseId }) };
        const mod = await Test.createTestingModule({
            imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), PassportModule],
            controllers: [RecordingsController],
            providers: [RecordingsService, JwtStrategy,
                { provide: StorageService, useValue: {} },
                { provide: UsersService, useValue: users },
                { provide: getRepositoryToken(Recording), useValue: db },
                ...[Reaction, Comment, RecordingView].map((e) => ({ provide: getRepositoryToken(e), useValue: {} }))],
        }).compile();
        app = mod.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });
    afterEach(async () => { await app.close(); });

    const post = (body: object, bearer?: string) => {
        const r = request(app.getHttpServer()).post('/recordings');
        if (bearer) r.set('Authorization', `Bearer ${bearer}`);
        return r.send(body);
    };
    const video = (extra: object = {}) => ({ title: 'Video', fileUrl: 'video-a.webm', type: 'video', ...extra });

    /** The victim's recording, owned and permanent. */
    async function ownedRecording() {
        const res = await post(video({ id: VICTIM_ID }), token(OWNER));
        expect(res.status).toBe(201);
        return structuredClone(db.rows.get(VICTIM_ID));
    }

    describe('a new id', () => {
        it('creates an owned, permanent row for a signed-in caller', async () => {
            const res = await post(video({ id: VICTIM_ID }), token(OWNER));
            expect(res.status).toBe(201);
            expect(res.body.id).toBe(VICTIM_ID);
            expect(db.rows.get(VICTIM_ID)).toMatchObject({ user: { supabaseId: OWNER }, expiresAt: null });
        });

        it('creates an expiring guest row for an anonymous caller', async () => {
            const res = await post(video({ id: VICTIM_ID, guestId: 'guest_a' }));
            expect(res.status).toBe(201);
            expect(db.rows.get(VICTIM_ID)).toMatchObject({ user: null, guestId: 'guest_a' });
            expect(db.rows.get(VICTIM_ID).expiresAt).toBeInstanceOf(Date);
        });

        it('generates an id when none is sent', async () => {
            const res = await post(video({ guestId: 'guest_a' }));
            expect(res.status).toBe(201);
            expect(db.rows.has(res.body.id)).toBe(true);
        });

        it('rejects an id that is not a UUID instead of failing in the database', async () => {
            const res = await post(video({ id: 'not-a-uuid', guestId: 'guest_a' }));
            expect(res.status).toBe(400);
            expect(db.rows.size).toBe(0);
        });
    });

    describe('an existing id from someone else', () => {
        it('the one-hour-expiry attack: anonymous, guestId, victim id -> 409 and the row is untouched', async () => {
            const before = await ownedRecording();
            const res = await post({ id: VICTIM_ID, title: 'pwned', fileUrl: 'evil.webm', type: 'video', guestId: 'guest_attacker' });

            expect(res.status).toBe(409);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
            expect(db.rows.get(VICTIM_ID).expiresAt).toBeNull();
        });

        it('the same attack with an expired token -> 401 (see expired-token.spec.ts), untouched', async () => {
            const before = await ownedRecording();
            const res = await post(video({ id: VICTIM_ID, fileUrl: 'evil.webm', guestId: 'guest_attacker' }), token(OWNER, -60));
            expect(res.status).toBe(401);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });

        it('another signed-in user -> 409, untouched', async () => {
            const before = await ownedRecording();
            const res = await post(video({ id: VICTIM_ID, fileUrl: 'evil.webm' }), token(STRANGER));
            expect(res.status).toBe(409);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });

        it('another guest -> 409, and the guest row keeps its guest and its expiry', async () => {
            await post(video({ id: VICTIM_ID, guestId: 'guest_a' }));
            const before = structuredClone(db.rows.get(VICTIM_ID));
            const res = await post(video({ id: VICTIM_ID, guestId: 'guest_b' }));
            expect(res.status).toBe(409);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });

        it('a signed-in user cannot take over a guest row by posting its id', async () => {
            await post(video({ id: VICTIM_ID, guestId: 'guest_a' }));
            const before = structuredClone(db.rows.get(VICTIM_ID));
            const res = await post(video({ id: VICTIM_ID }), token(STRANGER));
            expect(res.status).toBe(409);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });

        it('the owner posting different content under the same id is not a retry -> 409', async () => {
            const before = await ownedRecording();
            const res = await post(video({ id: VICTIM_ID, fileUrl: 'video-b.webm' }), token(OWNER));
            expect(res.status).toBe(409);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });
    });

    describe('an idempotent retry', () => {
        it('the same guest posting the same recording again -> 200 with the existing row, nothing written', async () => {
            const first = await post(video({ id: VICTIM_ID, guestId: 'guest_a' }));
            const before = structuredClone(db.rows.get(VICTIM_ID));
            const again = await post(video({ id: VICTIM_ID, guestId: 'guest_a' }));
            expect(again.status).toBe(200);
            expect(again.body.id).toBe(first.body.id);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });

        it('the same owner posting the same recording again -> 200, nothing written', async () => {
            const before = await ownedRecording();
            const again = await post(video({ id: VICTIM_ID }), token(OWNER));
            expect(again.status).toBe(200);
            expect(again.body.id).toBe(VICTIM_ID);
            expect(db.rows.get(VICTIM_ID)).toEqual(before);
        });
    });

    describe('ownership comes from the token, never from the body', () => {
        it('an anonymous caller naming a userId -> 403, nothing created', async () => {
            const res = await post(video({ id: VICTIM_ID, userId: OWNER }));
            expect(res.status).toBe(403);
            expect(db.rows.size).toBe(0);
        });

        it('a signed-in caller naming someone else -> 403, nothing created', async () => {
            const res = await post(video({ id: VICTIM_ID, userId: OWNER }), token(STRANGER));
            expect(res.status).toBe(403);
            expect(db.rows.size).toBe(0);
        });

        it('a signed-in caller naming themselves still works (what the web app sends)', async () => {
            const res = await post(video({ id: VICTIM_ID, userId: OWNER }), token(OWNER));
            expect(res.status).toBe(201);
            expect(db.rows.get(VICTIM_ID)).toMatchObject({ user: { supabaseId: OWNER } });
        });
    });
});
