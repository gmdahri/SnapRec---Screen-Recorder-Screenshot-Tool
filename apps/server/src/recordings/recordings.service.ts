import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';

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
        private readonly usersService: UsersService,
    ) { }

    async create(createRecordingDto: CreateRecordingDto, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<Recording> {
        const recording = new Recording();
        if (createRecordingDto.id) {
            recording.id = createRecordingDto.id;
        }
        recording.title = createRecordingDto.title;
        recording.fileUrl = createRecordingDto.fileUrl;
        recording.type = createRecordingDto.type;

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

        return this.recordingsRepository.save(recording);
    }

    async findAll(userId?: string): Promise<Recording[]> {
        const query: any = {
            order: { createdAt: 'DESC' },
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
            recording.views += 1;
            await this.recordingsRepository.save(recording);
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

    async addComment(recordingId: string, content: string, userId?: string, guestId?: string, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<Comment> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        const comment = new Comment();
        comment.recording = recording;
        comment.content = content;

        if (userId) {
            comment.user = await this.usersService.findOrCreateBySupabaseId(userId, userMeta);
        } else if (guestId) {
            comment.guestId = guestId;
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
            const alreadyMine = recording.user?.supabaseId === userId;
            const ownerless = recording.user === null || recording.user === undefined;

            // An ownerless row is only claimable when it is provably this
            // guest's, or when it predates the guestId column entirely.
            const isThisGuests = recording.guestId
                ? recording.guestId === guestId
                : true;

            if (alreadyMine || (ownerless && isThisGuests)) {
                recording.user = user;
                recording.guestId = null;
                claimed.push(recording.id);
            }
            // Else: belongs to another user or another guest; skip.
        }

        await this.recordingsRepository.save(recordings);
        return { claimed };
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

        if (updateRecordingDto.title) {
            recording.title = updateRecordingDto.title;
        }

        if (updateRecordingDto.fileUrl) {
            recording.fileUrl = updateRecordingDto.fileUrl;
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