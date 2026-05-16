import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis, { Redis } from 'ioredis';

export const AI_PIPELINE_QUEUE_NAME = 'ai-pipeline';

export interface AiPipelineJobData {
    recordingId: string;
}

/**
 * Wraps a BullMQ queue for the AI pipeline. If REDIS_URL is not configured,
 * `enabled` will be false and callers should fall back to setImmediate.
 */
@Injectable()
export class AiPipelineQueue implements OnModuleDestroy {
    private readonly logger = new Logger(AiPipelineQueue.name);
    private readonly connection: Redis | null;
    private readonly queue: Queue<AiPipelineJobData> | null;
    private readonly events: QueueEvents | null;

    constructor(private readonly configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL');
        if (!redisUrl) {
            this.logger.warn('REDIS_URL not configured — falling back to in-process setImmediate for AI pipeline');
            this.connection = null;
            this.queue = null;
            this.events = null;
            return;
        }

        try {
            this.connection = new IORedis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                tls: redisUrl.startsWith('rediss://') ? {} : undefined,
            });
            this.queue = new Queue<AiPipelineJobData>(AI_PIPELINE_QUEUE_NAME, {
                connection: this.connection,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 30_000 },
                    removeOnComplete: { count: 100, age: 24 * 3600 },
                    removeOnFail: { count: 500, age: 7 * 24 * 3600 },
                },
            });
            this.events = new QueueEvents(AI_PIPELINE_QUEUE_NAME, { connection: this.connection });
            this.events.on('failed', ({ jobId, failedReason }) => {
                this.logger.error(`Job ${jobId} failed: ${failedReason}`);
            });
            this.logger.log('BullMQ queue enabled (Upstash Redis)');
        } catch (err) {
            this.logger.error('Failed to initialize BullMQ queue, falling back to setImmediate', err);
            this.connection = null;
            this.queue = null;
            this.events = null;
        }
    }

    get enabled(): boolean {
        return this.queue !== null;
    }

    async enqueue(recordingId: string): Promise<{ jobId: string | undefined; viaQueue: boolean }> {
        if (!this.queue) return { jobId: undefined, viaQueue: false };
        const job = await this.queue.add(
            'process',
            { recordingId },
            { jobId: `recording-${recordingId}` },
        );
        return { jobId: job.id, viaQueue: true };
    }

    getQueue(): Queue<AiPipelineJobData> | null {
        return this.queue;
    }

    getConnection(): Redis | null {
        return this.connection;
    }

    async onModuleDestroy(): Promise<void> {
        await this.events?.close().catch(() => undefined);
        await this.queue?.close().catch(() => undefined);
        this.connection?.disconnect();
    }
}
