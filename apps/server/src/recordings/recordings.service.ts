import { Injectable, NotFoundException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { Transcript } from '../transcription/entities/transcript.entity';
import { Summary } from '../ai/entities/summary.entity';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
import { TranscriptionService } from '../transcription/transcription.service';
import { AiSummaryService } from '../ai/ai-summary.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class RecordingsService implements OnModuleInit {
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        @InjectRepository(Reaction)
        private readonly reactionsRepository: Repository<Reaction>,
        @InjectRepository(Comment)
        private readonly commentsRepository: Repository<Comment>,
        @InjectRepository(Transcript)
        private readonly transcriptsRepository: Repository<Transcript>,
        @InjectRepository(Summary)
        private readonly summariesRepository: Repository<Summary>,
        private readonly usersService: UsersService,
        private readonly transcriptionService: TranscriptionService,
        private readonly aiSummaryService: AiSummaryService,
        private readonly subscriptionsService: SubscriptionsService,
        private readonly mailService: MailService,
    ) { }

    /**
     * On boot, sweep any recordings stuck in 'processing' for >30 min (server restart
     * killed the in-process pipeline) and flip them to 'failed' so users can retry.
     */
    async onModuleInit(): Promise<void> {
        try {
            const cutoff = new Date(Date.now() - 30 * 60 * 1000);
            const stuck = await this.recordingsRepository.find({
                where: [
                    { transcriptStatus: 'processing' as any, updatedAt: LessThan(cutoff) },
                    { summaryStatus: 'processing' as any, updatedAt: LessThan(cutoff) },
                ],
            });
            if (stuck.length === 0) return;
            for (const r of stuck) {
                if (r.transcriptStatus === 'processing') r.transcriptStatus = 'failed';
                if (r.summaryStatus === 'processing') r.summaryStatus = 'failed';
                r.transcriptFailReason = r.transcriptFailReason || 'process_restart';
            }
            await this.recordingsRepository.save(stuck);
            this.logger.warn(`Swept ${stuck.length} stuck AI pipeline rows to failed`);
        } catch (err) {
            this.logger.error('Stuck-row sweep failed', err);
        }
    }

    async create(createRecordingDto: CreateRecordingDto, userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<Recording> {
        const recording = new Recording();
        if (createRecordingDto.id) {
            recording.id = createRecordingDto.id;
        }
        recording.title = createRecordingDto.title;
        recording.fileUrl = createRecordingDto.fileUrl;
        recording.type = createRecordingDto.type;

        const userId = createRecordingDto.userId || createRecordingDto.guestId;
        if (userId) {
            recording.user = await this.usersService.findOrCreateBySupabaseId(userId, userMeta);
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
            relations: ['user', 'reactions', 'reactions.user', 'comments', 'comments.user', 'transcript', 'summary']
        });

        if (recording) {
            recording.views += 1;
            await this.recordingsRepository.save(recording);
        }

        return recording;
    }

    /**
     * Kick off the AI pipeline for a recording. Idempotent: returns current state if
     * already pending/processing/ready; otherwise sets pending and fires the pipeline.
     * Caller must ensure the user has Pro plan + ownership before calling.
     */
    async startAiPipeline(recordingId: string): Promise<{
        recordingId: string;
        transcriptStatus: string;
        summaryStatus: string;
        started: boolean;
    }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) throw new NotFoundException('Recording not found');

        const inFlight =
            recording.transcriptStatus === 'pending' ||
            recording.transcriptStatus === 'processing' ||
            recording.summaryStatus === 'pending' ||
            recording.summaryStatus === 'processing';
        const alreadyReady = recording.summaryStatus === 'ready';

        if (inFlight || alreadyReady) {
            return {
                recordingId: recording.id,
                transcriptStatus: recording.transcriptStatus,
                summaryStatus: recording.summaryStatus,
                started: false,
            };
        }

        recording.transcriptStatus = 'pending';
        recording.summaryStatus = 'pending';
        recording.transcriptFailReason = null;
        await this.recordingsRepository.save(recording);

        // Fire-and-forget; the service tracks state on the recording row.
        setImmediate(() => {
            this.runAiPipeline(recording.id).catch((err) => {
                this.logger.error(`runAiPipeline failed for ${recording.id}`, err);
            });
        });

        return {
            recordingId: recording.id,
            transcriptStatus: 'pending',
            summaryStatus: 'pending',
            started: true,
        };
    }

    private async runAiPipeline(recordingId: string): Promise<void> {
        let recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) return;

        try {
            recording.transcriptStatus = 'processing';
            await this.recordingsRepository.save(recording);
            await this.transcriptionService.transcribe(recordingId);

            // Re-load after transcribe (it mutates statuses)
            recording = await this.recordingsRepository.findOne({
                where: { id: recordingId },
                relations: ['user'],
            });
            if (!recording || recording.transcriptStatus !== 'ready') return;

            recording.summaryStatus = 'processing';
            await this.recordingsRepository.save(recording);
            await this.aiSummaryService.summarize(recordingId);

            // Notify user (fire-and-forget)
            const finalRecording = await this.recordingsRepository.findOne({
                where: { id: recordingId },
                relations: ['user', 'summary'],
            });
            if (finalRecording?.user?.email && finalRecording.summary) {
                this.mailService
                    .sendInsightsReady(
                        finalRecording.user.email,
                        finalRecording.user.fullName,
                        finalRecording.id,
                        finalRecording.title,
                        finalRecording.summary.tldr,
                        finalRecording.summary.actionItemsJson.slice(0, 3).map((a) => a.text),
                    )
                    .catch((err) =>
                        this.logger.error('Failed to queue insights-ready email', err),
                    );
            }
        } catch (err: any) {
            this.logger.error(`AI pipeline failed for ${recordingId}: ${err?.message}`, err);
            const r = await this.recordingsRepository.findOne({ where: { id: recordingId } });
            if (!r) return;
            if (r.transcriptStatus === 'processing' || r.transcriptStatus === 'pending') {
                r.transcriptStatus = 'failed';
                r.transcriptFailReason = err?.message?.slice(0, 250) ?? 'unknown';
            }
            if (r.summaryStatus === 'processing' || r.summaryStatus === 'pending') {
                r.summaryStatus = 'failed';
            }
            await this.recordingsRepository.save(r);
        }
    }

    async regenerateSummary(recordingId: string): Promise<{ started: boolean }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
        });
        if (!recording) throw new NotFoundException('Recording not found');
        if (recording.transcriptStatus !== 'ready') {
            throw new ForbiddenException('Transcript must be ready before regenerating summary');
        }
        if (recording.summaryStatus === 'processing' || recording.summaryStatus === 'pending') {
            return { started: false };
        }
        recording.summaryStatus = 'pending';
        await this.recordingsRepository.save(recording);
        setImmediate(() => {
            (async () => {
                const r = await this.recordingsRepository.findOne({ where: { id: recordingId } });
                if (!r) return;
                r.summaryStatus = 'processing';
                await this.recordingsRepository.save(r);
                try {
                    await this.aiSummaryService.summarize(recordingId);
                } catch (err) {
                    this.logger.error('regenerateSummary failed', err);
                    const r2 = await this.recordingsRepository.findOne({ where: { id: recordingId } });
                    if (r2) {
                        r2.summaryStatus = 'failed';
                        await this.recordingsRepository.save(r2);
                    }
                }
            })().catch(() => undefined);
        });
        return { started: true };
    }

    async deleteTranscript(recordingId: string, userId: string): Promise<{ success: boolean }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) throw new NotFoundException('Recording not found');
        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to modify this recording');
        }
        await this.summariesRepository.delete({ recordingId });
        await this.transcriptsRepository.delete({ recordingId });
        recording.transcriptStatus = 'none';
        recording.summaryStatus = 'none';
        recording.transcriptFailReason = null;
        await this.recordingsRepository.save(recording);
        return { success: true };
    }

    async checkAiOwnership(recordingId: string, supabaseUserId: string): Promise<Recording> {
        const recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) throw new NotFoundException('Recording not found');
        if (recording.user?.supabaseId !== supabaseUserId) {
            throw new ForbiddenException('You do not have permission to process this recording');
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

    async claimRecordings(userId: string, recordingIds: string[], userMeta?: { email?: string; fullName?: string; avatarUrl?: string }): Promise<{ claimed: string[] }> {
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
            // Only claim guest recordings (no owner) or recordings already owned by this user
            if (recording.user === null || recording.user?.supabaseId === userId) {
                recording.user = user;
                claimed.push(recording.id);
            }
            // Else: recording belongs to another user; skip (do not allow stealing)
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
}
