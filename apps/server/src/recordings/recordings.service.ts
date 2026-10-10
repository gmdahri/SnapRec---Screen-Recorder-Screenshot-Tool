import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { expiresAtForUpload } from './expiry';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, LessThan } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { RecordingView } from './entities/recording-view.entity';
import { mergeIntervals } from './intervals';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
import { PublishRecordingDto } from './dto/publish-recording.dto';

/** What create() did: made the row, or recognised a retry of one it had made. */
export interface CreateRecordingResult {
    recording: Recording;
    created: boolean;
}

@Injectable()
export class RecordingsService {
    private readonly logger = new Logger(RecordingsService.name);

    /** Deletes guest recordings nobody claimed.
     *
     * Runs every five minutes against a one-hour window. A failure to remove
     * the R2 object must not stop the row going: a stuck sweep would let rows
     * accumulate silently, which is exactly what this exists to prevent.
     *
     * Each row is deleted only if it is *still* expired when the DELETE runs,
     * and its file only once that DELETE removed it. Reading the expired rows
     * and then removing them unconditionally deleted a recording — and its
     * file — that its guest had claimed in between. */
    async sweepExpired(now: Date = new Date()): Promise<{ deleted: number }> {
        const due = await this.recordingsRepository.find({
            where: { expiresAt: LessThan(now) },
        });
        if (!due.length) return { deleted: 0 };

        // A key another recording still uses is not this row's to delete.
        // Rows pointing at someone else's file were registrable until the
        // key rule in assertKeyAvailable existed, so some may already be here.
        const dueIds = new Set(due.map((r) => r.id));
        const sharers = await this.recordingsRepository.find({
            where: { fileUrl: In([...new Set(due.map((r) => r.fileUrl))]) },
        });
        const stillUsed = new Set(sharers.filter((r) => !dueIds.has(r.id)).map((r) => r.fileUrl));

        let deleted = 0;
        for (const recording of due) {
            const { affected } = await this.recordingsRepository.delete({
                id: recording.id, expiresAt: LessThan(now),
            });
            if (!affected) continue; // claimed since the read: not ours to delete
            deleted++;
            if (stillUsed.has(recording.fileUrl)) {
                this.logger.warn(`Sweep: kept ${recording.fileUrl}, still used by another recording`);
                continue;
            }
            try {
                await this.storageService.deleteObject(recording.fileUrl);
            } catch (e) {
                this.logger.warn(
                    `Sweep: could not delete ${recording.fileUrl}: ${(e as Error).message}`);
            }
        }
        return { deleted };
    }

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
        // Last, so every existing positional construction stays valid.
        private readonly storageService: StorageService,
    ) { }

    /** Creates a recording. Never updates one.
     *
     * This used to end in repository.save(), which TypeORM turns into an
     * UPDATE when the id already exists — and ids are not secret, every share
     * link carries one. Anyone could POST a victim's id with no token and a
     * guestId and the row was rewritten as a guest upload expiring in an hour,
     * after which the sweep deleted it. Now an existing id is never written:
     * a retry of the same upload by the same owner gets the existing row back,
     * and anything else is a conflict.
     *
     * The caller must already have settled ownership: dto.userId is trusted
     * here, so the controller only ever passes the token's subject. */
    async create(createRecordingDto: CreateRecordingDto, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<CreateRecordingResult> {
        if (createRecordingDto.id) {
            const existing = await this.findForCreate(createRecordingDto.id);
            if (existing) return this.resolveExistingId(existing, createRecordingDto);
        }
        await this.assertKeyAvailable(createRecordingDto.fileUrl);

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

        // A guest upload is temporary until somebody claims it. Signing in and
        // claiming clears this; a signed-in recording never carries it.
        recording.expiresAt = expiresAtForUpload(Boolean(createRecordingDto.userId));

        let id: string;
        try {
            // insert(), not save(): an INSERT that cannot become an UPDATE.
            const result = await this.recordingsRepository.insert(recording);
            id = result.identifiers[0].id;
        } catch (error: any) {
            // Two requests for the same id raced past the lookup above.
            if (error?.code !== '23505' || !createRecordingDto.id) throw error;
            const existing = await this.findForCreate(createRecordingDto.id);
            if (!existing) throw error;
            return this.resolveExistingId(existing, createRecordingDto);
        }
        return { recording: (await this.findForCreate(id))!, created: true };
    }

    /** A key belongs to the recording that first registered it.
     *
     * Nothing used to tie a fileUrl to the upload that created it, so a
     * recording could be registered — anonymously — on someone else's key,
     * and when it expired the sweep deleted their file. `exceptId` is the
     * recording being changed, which may keep its own key. */
    private async assertKeyAvailable(fileUrl: string, exceptId?: string): Promise<void> {
        const holders = await this.recordingsRepository.find({ where: { fileUrl } });
        if (holders.some((r) => r.id !== exceptId)) {
            throw new ConflictException('This file belongs to another recording');
        }
    }

    private findForCreate(id: string): Promise<Recording | null> {
        return this.recordingsRepository.findOne({ where: { id }, relations: ['user'] });
    }

    /** An existing id is answered, never written.
     *
     * A retry — the same owner, or the same guest on an ownerless row, sending
     * the same file — gets the row back, so an uploader that lost the first
     * response can safely ask again. Everyone else gets a conflict that says
     * nothing about who owns the id. */
    private resolveExistingId(existing: Recording, dto: CreateRecordingDto): CreateRecordingResult {
        const sameOwner = dto.userId
            ? existing.user?.supabaseId === dto.userId
            : !existing.user && !!dto.guestId && existing.guestId === dto.guestId;
        const sameUpload = existing.fileUrl === dto.fileUrl && existing.type === dto.type;
        if (sameOwner && sameUpload) return { recording: existing, created: false };
        throw new ConflictException('A recording with this id already exists');
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

        if (recording) {
            // UPDATE … SET views = views + 1, and nothing else. Saving the loaded
            // row wrote every column of a possibly stale copy back: a claim that
            // landed between this read and that save was undone, and the sweep
            // then deleted the recording its owner had just claimed.
            await this.recordingsRepository.increment({ id }, 'views', 1);
            recording.views += 1;
        }

        return recording;
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
     * With `guestId` supplied, a recording is only claimable when it carries
     * the same guestId. Rows predating that column have none, so they stay
     * claimable by id alone: rejecting them would strand real guests who
     * uploaded before the migration, and inventing a guestId for them would
     * hand them to whoever asked first. That residue shrinks to nothing as old
     * guest captures pass their 7-day expiry. */
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
            if (recording.user?.supabaseId === userId) {
                claimed.push(recording.id);
                continue;
            }
            if (recording.user) continue; // another user's

            // An ownerless row is only claimable when it is provably this
            // guest's, or when it predates the guestId column entirely.
            const isThisGuests = recording.guestId
                ? recording.guestId === guestId
                : true;
            if (!isThisGuests) continue;

            /* The conditions travel with the write: still ownerless, still the
             * same guest. Saving the loaded rows instead wrote every stale
             * column back (a view counted meanwhile was lost) and let two
             * concurrent claims both "win". Claiming is what makes a recording
             * permanent — expiresAt null is the line that saves it from the
             * sweep. */
            const { affected } = await this.recordingsRepository.update(
                { id: recording.id, user: IsNull(), guestId: recording.guestId ?? IsNull() },
                { user: { id: user.id }, guestId: null, expiresAt: null },
            );
            if (affected) claimed.push(recording.id);
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

        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

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

        await this.assertKeyAvailable(dto.fileUrl, id);
        const changes: Partial<Recording> = { fileUrl: dto.fileUrl };
        if (typeof dto.durationSec === 'number') changes.durationSec = dto.durationSec;
        Object.assign(recording, changes);

        // Counted before saving so the number describes the change being made.
        const endMs = (dto.durationSec ?? recording.durationSec ?? 0) * 1000;
        const staleComments = endMs > 0
            ? (recording.comments ?? []).filter(
                (c) => typeof c.timecodeMs === 'number' && c.timecodeMs > endMs,
            ).length
            : 0;

        // Only the columns being changed: see update().
        await this.recordingsRepository.update(id, changes);
        this.logger.log(`Published over recording ${id}; ${staleComments} comment(s) now past the end`);
        return { recording, staleComments };
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

        const changes: Partial<Recording> = {};
        if (updateRecordingDto.title) {
            changes.title = updateRecordingDto.title;
        }

        if (updateRecordingDto.fileUrl) {
            await this.assertKeyAvailable(updateRecordingDto.fileUrl, id);
            changes.fileUrl = updateRecordingDto.fileUrl;
        }

        // `!== undefined`, not truthiness: an empty string is how a description
        // is cleared, and a truthy check would make removing one impossible.
        if (updateRecordingDto.description !== undefined) {
            changes.description = updateRecordingDto.description;
        }

        /* Only the columns being changed. Saving the loaded row wrote every
         * column of a possibly stale copy back, so views counted meanwhile
         * were lost. */
        if (Object.keys(changes).length) await this.recordingsRepository.update(id, changes);
        return Object.assign(recording, changes);
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
     * NOTE: sr_recordings has no isPublic/sharingDisabledAt columns yet. Until
     * they exist every uploaded recording is reachable by anyone holding the
     * link, so an absent pair reports 'link'. Reporting 'restricted' would be
     * a lie about what the product currently does. */
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