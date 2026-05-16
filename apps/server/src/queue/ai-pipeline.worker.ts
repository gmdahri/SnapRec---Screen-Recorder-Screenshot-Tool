import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { AiPipelineQueue, AI_PIPELINE_QUEUE_NAME, AiPipelineJobData } from './ai-pipeline.queue';
import { Recording } from '../recordings/entities/recording.entity';
import { TranscriptionService } from '../transcription/transcription.service';
import { AiSummaryService } from '../ai/ai-summary.service';
import { MailService } from '../mail/mail.service';

/**
 * BullMQ worker that runs the AI pipeline (transcribe -> summarize -> notify).
 * Only starts when REDIS_URL is configured. Each job is one recording end-to-end.
 * BullMQ handles retries, persistence, and re-queuing on server restart.
 */
@Injectable()
export class AiPipelineWorker implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AiPipelineWorker.name);
    private worker: Worker<AiPipelineJobData> | null = null;

    constructor(
        private readonly queueService: AiPipelineQueue,
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        private readonly transcriptionService: TranscriptionService,
        private readonly aiSummaryService: AiSummaryService,
        private readonly mailService: MailService,
    ) {}

    async onModuleInit(): Promise<void> {
        const connection = this.queueService.getConnection();
        if (!connection) return; // Queue disabled — caller handles fallback

        this.worker = new Worker<AiPipelineJobData>(
            AI_PIPELINE_QUEUE_NAME,
            async (job: Job<AiPipelineJobData>) => this.runPipeline(job.data.recordingId),
            {
                connection,
                concurrency: Number(process.env.AI_PIPELINE_CONCURRENCY || '2'),
                lockDuration: 10 * 60 * 1000,
            },
        );

        this.worker.on('completed', (job) => {
            this.logger.log(`Pipeline completed for recording ${job.data.recordingId} (attempt ${job.attemptsMade})`);
        });
        this.worker.on('failed', (job, err) => {
            this.logger.error(
                `Pipeline failed for recording ${job?.data.recordingId} on attempt ${job?.attemptsMade}: ${err.message}`,
            );
        });

        this.logger.log(`AI pipeline worker started (concurrency=${process.env.AI_PIPELINE_CONCURRENCY || '2'})`);
    }

    private async runPipeline(recordingId: string): Promise<void> {
        let recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) {
            this.logger.warn(`Recording ${recordingId} not found — skipping`);
            return;
        }

        try {
            recording.transcriptStatus = 'processing';
            await this.recordingsRepository.save(recording);
            await this.transcriptionService.transcribe(recordingId);

            recording = await this.recordingsRepository.findOne({
                where: { id: recordingId },
                relations: ['user'],
            });
            if (!recording || recording.transcriptStatus !== 'ready') return;

            recording.summaryStatus = 'processing';
            await this.recordingsRepository.save(recording);
            await this.aiSummaryService.summarize(recordingId);

            const final = await this.recordingsRepository.findOne({
                where: { id: recordingId },
                relations: ['user', 'summary'],
            });
            if (final?.user?.email && final.summary) {
                this.mailService
                    .sendInsightsReady(
                        final.user.email,
                        final.user.fullName,
                        final.id,
                        final.title,
                        final.summary.tldr,
                        final.summary.actionItemsJson.slice(0, 3).map((a) => a.text),
                    )
                    .catch((err) => this.logger.error('Failed to send insights-ready email', err));
            }
        } catch (err: any) {
            this.logger.error(`Pipeline error for ${recordingId}: ${err?.message}`);
            const r = await this.recordingsRepository.findOne({ where: { id: recordingId } });
            if (!r) throw err;
            if (r.transcriptStatus === 'processing' || r.transcriptStatus === 'pending') {
                r.transcriptStatus = 'failed';
                r.transcriptFailReason = err?.message?.slice(0, 250) ?? 'unknown';
            }
            if (r.summaryStatus === 'processing' || r.summaryStatus === 'pending') {
                r.summaryStatus = 'failed';
            }
            await this.recordingsRepository.save(r);
            throw err; // BullMQ retry
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.worker?.close().catch(() => undefined);
    }
}
