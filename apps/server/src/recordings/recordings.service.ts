import { Injectable, NotFoundException, ForbiddenException, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StorageService } from '../storage/storage.service';
import { Repository, In } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { RecordingView } from './entities/recording-view.entity';
import { mergeIntervals } from './intervals';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
import { PublishRecordingDto } from './dto/publish-recording.dto';

@Injectable()
export class RecordingsService {
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        @InjectRepository(Reaction)
        private readonly reactionsRepository: Repository<Reaction>,
        @InjectRepository(Comment)
        private readonly commentsRepository: Repository<Comment>,
        @InjectRepository(RecordingView)
        private readonly viewsRepository: Repository<RecordingView>,
        private readonly usersService: UsersService,
        private readonly storage: StorageService,
    ) { }

    async create(createRecordingDto: CreateRecordingDto, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<Recording> {
        const recording = new Recording();
        if (createRecordingDto.id) {
            recording.id = createRecordingDto.id;
        }
        recording.title = createRecordingDto.title;
        recording.fileUrl = createRecordingDto.fileUrl;
        recording.type = createRecordingDto.type;
        // Absent means unknown, not zero: a screenshot has no length, and an
        // uploader that could not measure the file should leave the column null
        // so the client can fall back rather than render a confident "0:00".
        recording.durationSec = createRecordingDto.durationSec ?? null;
        recording.widthPx = createRecordingDto.widthPx ?? null;
        recording.heightPx = createRecordingDto.heightPx ?? null;

        // A guestId is NOT a user id. Passing it to findOrCreateBySupabaseId
        // minted a synthetic sr_users row keyed by the guest id, which made
        // the capture un-claimable — the claim compares the owner's supabaseId
        // against the signed-in user's, and a guest id never matches either
        // branch. Store it as what it is.
        if (createRecordingDto.userId) {
            recording.user = await this.usersService.findOrCreateBySupabaseId(
                createRecordingDto.userId, userMeta);
        } else if (createRecordingDto.guestId) {
            recording.guestId = createRecordingDto.guestId;
        }

        // INSERT, never save/upsert: a client-supplied existing id must not replace a row.
        try { await this.recordingsRepository.insert(recording); }
        catch (error) { if (error.code === '23505') throw new ConflictException('Capture already exists'); throw error; }
        return recording;
    }

    async findAll(userId?: string): Promise<Recording[]> {
        const query: any = {
            order: { createdAt: 'DESC' },
            // None of these relations are eager, so omitting them here does not
            // return empty arrays — it leaves the keys absent entirely, and the
            // web's `Recording` type declares them as required. Home, Library
            // and Analytics all read `.comments.length` off this list, and
            // `comments.user` is what decides whether the newest comment came
            // from someone other than the owner.
            relations: ['user', 'reactions', 'comments', 'comments.user'],
        };

        if (userId) {
            query.where = { user: { supabaseId: userId } };
        }

        return this.recordingsRepository.find(query);
    }

    async findOne(id: string): Promise<Recording | null> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user', 'reactions', 'reactions.user', 'comments', 'comments.user']
        });

        return recording;
    }

    async assertAccess(id: string, userId?: string): Promise<Recording> {
        const recording = await this.findOne(id);
        if (!recording || ((recording.isPublic === false || recording.sharingDisabledAt) && (!userId || recording.user?.supabaseId !== userId))) {
            throw new NotFoundException('Recording unavailable. Sign in if this is your capture.');
        }
        // Never expose the credential used to claim an anonymous capture.
        recording.guestId = null;
        return recording;
    }

    async assertFileAccess(fileName: string, userId?: string): Promise<void> {
        const recording = await this.recordingsRepository.findOne({ where: { fileUrl: fileName }, relations: ['user'] });
        if (recording) { await this.assertAccess(recording.id, userId); return; }
        // Owners can preview a newly uploaded editor asset before publishing it.
        if (userId) {
            const rows = await this.recordingsRepository.query('SELECT key FROM sr_upload_grants WHERE key=$1 AND principal=$2', [fileName, `user:${userId}`]);
            if (rows.length) return;
        }
        throw new NotFoundException('Media unavailable');
    }

    async recordQualifiedView(id: string, sessionId: string, userId?: string) {
        const recording = await this.assertAccess(id, userId);
        if (userId && recording.user?.supabaseId === userId) return { counted: false };
        const rows = await this.recordingsRepository.query(`WITH added AS (
            INSERT INTO sr_qualified_views ("recordingId","sessionId") VALUES ($1,$2)
            ON CONFLICT DO NOTHING RETURNING 1
        ) UPDATE sr_recordings SET views=views+1 WHERE id=$1 AND EXISTS (SELECT 1 FROM added) RETURNING id`, [id, sessionId]);
        return { counted: rows.length > 0 };
    }

    async addReaction(recordingId: string, type: string, userId?: string, guestId?: string, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<Reaction> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        let reaction = await this.reactionsRepository.findOne({
            where: userId ? { recording: { id: recordingId }, user: { supabaseId: userId } } : { recording: { id: recordingId }, guestId }
        });

        if (reaction) {
            if (reaction.type === type) {
                await this.reactionsRepository.remove(reaction);
                return reaction; // Return the removed reaction or a flag
            }
            reaction.type = type;
        } else {
            reaction = new Reaction();
            reaction.recording = recording;
            reaction.type = type;
            if (userId) {
                reaction.user = await this.usersService.findOrCreateBySupabaseId(userId, userMeta);
            } else if (guestId) {
                reaction.guestId = guestId;
            }
        }

        return this.reactionsRepository.save(reaction);
    }

    /** `anchor` is what the comment is *about*: a moment for a video, a
     * normalised point for a screenshot, or nothing for a remark about the
     * capture as a whole.
     *
     * It has to be written here. The columns, the DTO and the viewer's rendering
     * all shipped with the anchor migration, but this method took no anchor and
     * saved none, so every video comment came back with a null timecode and the
     * viewer's `timecodeMs ?? 0` fallback drew it at 0:00 — a comment pinned at
     * 0:10 reopened at the start of the recording.
     *
     * Explicit nulls, not undefined: TypeORM leaves an undefined property out of
     * the INSERT, which is indistinguishable here but silently keeps whatever a
     * future default might be. */
    async addComment(
        recordingId: string,
        content: string,
        userId?: string,
        guestId?: string,
        userMeta?: { email?: string; fullName?: string; avatarUrl?: string },
        anchor?: { timecodeMs?: number; anchorX?: number; anchorY?: number },
    ): Promise<Comment> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        const comment = new Comment();
        comment.recording = recording;
        comment.content = content;

        comment.timecodeMs = anchor?.timecodeMs ?? null;
        // A point is only a point with both halves of it — half an anchor would
        // place a pin on the left edge of the image rather than nowhere.
        const hasPoint = anchor?.anchorX != null && anchor?.anchorY != null;
        comment.anchorX = hasPoint ? anchor!.anchorX! : null;
        comment.anchorY = hasPoint ? anchor!.anchorY! : null;

        if (userId) {
            comment.user = await this.usersService.findOrCreateBySupabaseId(userId, userMeta);
        } else if (guestId) {
            comment.guestId = guestId;
        }

        return this.commentsRepository.save(comment);
    }

    /** Marks a comment answered, or reopens it (P7 V3).
     *
     * Who may: the capture's owner, and the comment's own author. The author
     * matters because closing your own question is the common case, and the
     * owner matters because they are the one being asked.
     *
     * Who may not: guests. A guestId is a value anyone holding a share link can
     * read and send, so honouring it here would let any recipient close other
     * people's questions. Anonymous viewers can still ask — only settling is
     * restricted. */
    async setCommentResolved(
        recordingId: string,
        commentId: string,
        resolved: boolean,
        actorSupabaseId?: string,
        userMeta?: { email?: string; fullName?: string; avatarUrl?: string },
    ): Promise<Comment> {
        if (!actorSupabaseId) {
            throw new ForbiddenException('Sign in to resolve a comment');
        }

        const comment = await this.commentsRepository.findOne({
            where: { id: commentId },
            relations: ['recording', 'recording.user', 'user'],
        });
        if (!comment) throw new NotFoundException('Comment not found');
        // Scoped to the recording in the path so a valid comment id cannot be
        // resolved through someone else's capture.
        if (comment.recording?.id !== recordingId) {
            throw new NotFoundException('Comment not found');
        }

        const isOwner = comment.recording?.user?.supabaseId === actorSupabaseId;
        const isAuthor = comment.user?.supabaseId === actorSupabaseId;
        if (!isOwner && !isAuthor) {
            throw new ForbiddenException('Only the capture owner or the comment author can resolve it');
        }

        if (resolved) {
            const actor = await this.usersService.findOrCreateBySupabaseId(actorSupabaseId, userMeta);
            comment.resolvedAt = new Date();
            comment.resolvedByUserId = actor.id;
        } else {
            comment.resolvedAt = null;
            comment.resolvedByUserId = null;
        }

        return this.commentsRepository.save(comment);
    }

    /** Transfers guest captures to a signed-in user.
     *
     * SECURITY: an ownerless recording used to be claimable by anyone who knew
     * its id, and share links expose ids — so opening a guest's share link was
     * enough to take ownership of their capture.
     *
     * Only a hashed guest credential can authorize a claim. Legacy ownerless
     * records without proof must be recovered through support.
     */
    async claimRecordings(userId: string, recordingIds: string[], userMeta?: { email?: string; fullName?: string; avatarUrl?: string }, guestId?: string): Promise<{ claimed: string[] }> {
        const user = await this.usersService.findOrCreateBySupabaseId(userId, userMeta);
        const claimed: string[] = [];

        if (recordingIds.length === 0) {
            return { claimed };
        }

        const recordings = await this.recordingsRepository.find({
            where: { id: In(recordingIds) },
            relations: ['user'],
        });

        for (const recording of recordings) {
            const alreadyMine = recording.user?.supabaseId === userId;
            const ownerless = recording.user === null || recording.user === undefined;

            if (alreadyMine) { claimed.push(recording.id); continue; }
            const isThisGuests = !!guestId && guestId.startsWith('guest:') && recording.guestId === guestId;
            if (ownerless && isThisGuests) {
                // Conditional update closes the race between two simultaneous claims.
                const result = await this.recordingsRepository.createQueryBuilder()
                    .update(Recording).set({ user, guestId: null })
                    .where('id = :id AND "userId" IS NULL AND "guestId" = :guestId', { id: recording.id, guestId })
                    .execute();
                if (result.affected) claimed.push(recording.id);
            }
        }

        return { claimed };
    }

    /** Records what a signed-in viewer has watched (P7 V4).
     *
     * PRIVACY (plan O2): anonymous callers are accepted and ignored — the page
     * is public and a guest hitting this must not error, but no per-person row
     * is created for them. Their view is already counted on the recording.
     *
     * Coverage, not a high-water mark (plan O1): incoming ranges are merged
     * into whatever the viewer had already seen, so rewatching adds nothing and
     * skipping to the end stays near zero. */
    async recordWatchProgress(
        recordingId: string,
        ranges: Array<{ startSec: number; endSec: number }>,
        actorSupabaseId?: string,
        userMeta?: { email?: string; fullName?: string; avatarUrl?: string },
    ): Promise<{ coveredSec: number; recorded: boolean }> {
        if (!actorSupabaseId) return { coveredSec: 0, recorded: false };

        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId }, relations: ['user'] });
        if (!recording) throw new NotFoundException('Recording not found');
        if (recording.user?.supabaseId === actorSupabaseId) return { coveredSec: 0, recorded: false };

        const user = await this.usersService.findOrCreateBySupabaseId(actorSupabaseId, userMeta);

        let view = await this.viewsRepository.findOne({
            where: { recording: { id: recordingId }, user: { id: user.id } },
            relations: ['recording', 'user'],
        });
        if (!view) {
            view = this.viewsRepository.create({
                recording, user, watchedRangesJson: [], coveredSec: 0,
            });
        }

        // Clamped to the clip: a client reporting past the end would otherwise
        // push coverage above 100%, which is arithmetically impossible and
        // would hide a real bug behind a clamp at the display layer.
        const limit = recording.durationSec ?? 0;
        const incoming = ranges
            .map((r) => ({
                startSec: Math.max(0, r.startSec),
                endSec: limit > 0 ? Math.min(r.endSec, limit) : r.endSec,
            }))
            .filter((r) => r.endSec > r.startSec);

        const merged = mergeIntervals([...(view.watchedRangesJson ?? []), ...incoming]);
        view.watchedRangesJson = merged;
        view.coveredSec = Math.round(
            merged.reduce((sum, r) => sum + (r.endSec - r.startSec), 0),
        );

        await this.viewsRepository.save(view);
        return { coveredSec: view.coveredSec, recorded: true };
    }

    /** Mean coverage across signed-in viewers, 0–100, or null when nobody
     * signed in has watched.
     *
     * Null rather than zero on purpose: "0%" on a recording no signed-in viewer
     * has opened reads as "nobody watched it", when the truth is "we did not
     * measure". The viewer hides the tile instead. */
    async watchedPercent(recordingId: string): Promise<number | null> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording?.durationSec) return null;

        const views = await this.viewsRepository.find({
            where: { recording: { id: recordingId } },
        });
        if (views.length === 0) return null;

        const mean = views.reduce((sum, v) => sum + v.coveredSec, 0) / views.length;
        return Math.min(100, Math.round((mean / recording.durationSec) * 100));
    }

    /** Replaces the media behind a recording, keeping everything else (P7 E6).
     *
     * The link, the id, the view count and every comment survive — that is the
     * whole point, and it is what the editor's confirmation promises.
     *
     * It is destructive in one specific way the caller must surface: the
     * previous file is no longer reachable at this id. There is no version
     * history (O4), so the editor asks before calling this.
     *
     * Comments anchored past the new end are counted and returned rather than
     * deleted or silently left pointing into nothing. A comment that referred
     * to footage the author removed is still a real thing someone said; the
     * viewer marks it as pointing at removed footage. */
    async publish(
        id: string,
        dto: PublishRecordingDto,
        userId: string,
    ): Promise<{ recording: Recording; staleComments: number }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user', 'comments'],
        });
        if (!recording) throw new NotFoundException(`Recording with ID "${id}" not found`);
        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to publish over this recording');
        }

        recording.fileUrl = dto.fileUrl;
        if (typeof dto.durationSec === 'number') {
            recording.durationSec = dto.durationSec;
        }

        // Counted before saving so the number describes the change being made.
        const endMs = (dto.durationSec ?? recording.durationSec ?? 0) * 1000;
        const staleComments = endMs > 0
            ? (recording.comments ?? []).filter(
                (c) => typeof c.timecodeMs === 'number' && c.timecodeMs > endMs,
            ).length
            : 0;

        const saved = await this.recordingsRepository.save(recording);
        this.logger.log(`Published over recording ${id}; ${staleComments} comment(s) now past the end`);
        return { recording: saved, staleComments };
    }

    async update(id: string, updateRecordingDto: UpdateRecordingDto, userId: string): Promise<Recording> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });

        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to update this recording');
        }

        if (updateRecordingDto.isPublic !== undefined) {
            recording.isPublic = updateRecordingDto.isPublic;
            recording.sharingDisabledAt = updateRecordingDto.isPublic ? null : new Date();
        }
        if (updateRecordingDto.title) {
            recording.title = updateRecordingDto.title;
        }

        if (updateRecordingDto.fileUrl) {
            recording.fileUrl = updateRecordingDto.fileUrl;
        }

        // `!== undefined`, not truthiness: an empty string is how a description
        // is cleared, and a truthy check would make removing one impossible.
        if (updateRecordingDto.description !== undefined) {
            recording.description = updateRecordingDto.description;
        }

        return this.recordingsRepository.save(recording);
    }

    async delete(id: string, userId: string): Promise<{ success: boolean }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });

        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this recording');
        }

        // Fail before removing the row so a storage failure remains retryable.
        const [references] = await this.recordingsRepository.query('SELECT count(*)::int AS count FROM sr_recordings WHERE "fileUrl"=$1 AND id<>$2', [recording.fileUrl, id]);
        if (!references?.count) await this.storage.deleteObject(recording.fileUrl);
        await this.recordingsRepository.remove(recording);
        return { success: true };
    }

    /* ====================================================================
     * Shared surface (scene SHAR)
     *
     * Pure statics so the ordering and visibility rules are testable without
     * a database. They are the whole point of the page: it is sorted by what
     * you owe someone, not by what changed most recently.
     * ================================================================== */

    /** Anything awaiting a reply comes first; within each group, most recent
     * first. Sorting by date alone buries the one row that needs action. */
    static sortByObligation<T extends { needsReply: boolean; lastActivityAt: Date | null }>(
        rows: T[],
    ): T[] {
        return [...rows].sort((a, b) => {
            if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
            return (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0);
        });
    }

    /** A link the owner turned off is 'off', not merely absent — the page has
     * to offer turning it back on, which needs the distinction.
     *
     * The API enforces the same flags on metadata, downloads and interactions. */
    static visibilityOf(
        row: { isPublic?: boolean; sharingDisabledAt?: Date | null },
    ): 'link' | 'restricted' | 'off' {
        if (row.sharingDisabledAt) return 'off';
        if (row.isPublic === false) return 'restricted';
        return 'link';
    }

    /** True when the newest comment came from someone other than the owner. */
    static needsReply(
        row: { comments: { createdAt: Date; user?: { supabaseId?: string } }[] },
        ownerSupabaseId: string | undefined,
    ): boolean {
        if (!ownerSupabaseId || row.comments.length === 0) return false;
        const newest = [...row.comments]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .at(-1);
        return newest ? newest.user?.supabaseId !== ownerSupabaseId : false;
    }

    /** Captures this user has shared, ordered by obligation. */
    async findShared(userId: string, direction: 'by-me' | 'with-me' = 'by-me') {
        // 'with-me' needs a share-grant table that does not exist yet; until
        // then it is honestly empty rather than silently showing your own.
        if (direction === 'with-me') return [];

        const recordings = await this.recordingsRepository.find({
            where: { user: { supabaseId: userId } },
            relations: ['user', 'comments', 'comments.user'],
            order: { createdAt: 'DESC' },
        });

        const rows = recordings.map((r) => {
            const lastComment = [...(r.comments ?? [])]
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .at(-1);

            return {
                id: r.id,
                title: r.title,
                kind: r.type === 'video' ? 'recording' : 'screenshot',
                visibility: RecordingsService.visibilityOf(r as any),
                views: r.views,
                commentCount: r.comments?.length ?? 0,
                needsReply: RecordingsService.needsReply(r as any, userId),
                lastActivityAt: lastComment?.createdAt ?? r.createdAt,
                lastActor: lastComment?.user?.fullName ?? null,
            };
        });

        return RecordingsService.sortByObligation(rows);
    }

}