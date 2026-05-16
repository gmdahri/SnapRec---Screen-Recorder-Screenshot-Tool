import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { Summary } from './entities/summary.entity';
import { Transcript } from '../transcription/entities/transcript.entity';
import { Recording } from '../recordings/entities/recording.entity';
import {
    MEETING_SUMMARY_SYSTEM,
    MEETING_SUMMARY_PROMPT_VERSION,
    RECORD_MEETING_SUMMARY_TOOL,
} from './prompts/meeting-summary';

const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';
const MIN_DURATION_FOR_SUMMARY_SEC = 10;

const SummarySchema = z.object({
    tldr: z.string(),
    bullets: z.array(z.string()),
    actionItems: z.array(
        z.object({
            owner: z.string().nullable().optional(),
            text: z.string(),
            dueDate: z.string().nullable().optional(),
        }),
    ),
    chapters: z.array(z.object({ startSec: z.number(), title: z.string() })),
    keyDecisions: z.array(z.string()),
});

@Injectable()
export class AiSummaryService {
    private readonly logger = new Logger(AiSummaryService.name);
    private readonly anthropic: Anthropic | null;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Summary)
        private readonly summariesRepository: Repository<Summary>,
        @InjectRepository(Transcript)
        private readonly transcriptsRepository: Repository<Transcript>,
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
    ) {
        const key = this.configService.get<string>('ANTHROPIC_API_KEY');
        this.anthropic = key ? new Anthropic({ apiKey: key }) : null;
        if (!this.anthropic) {
            this.logger.warn('ANTHROPIC_API_KEY not configured — summarization disabled');
        }
    }

    async summarize(recordingId: string): Promise<void> {
        if (!this.anthropic) throw new Error('Anthropic not configured');

        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        if ((recording.durationSec ?? 0) < MIN_DURATION_FOR_SUMMARY_SEC) {
            recording.summaryStatus = 'skipped_short';
            await this.recordingsRepository.save(recording);
            return;
        }

        const transcript = await this.transcriptsRepository.findOne({
            where: { recordingId },
        });
        if (!transcript) throw new NotFoundException('Transcript not found');

        const transcriptText = this.buildTranscriptText(transcript.segmentsJson);
        const parsed = await this.callClaudeWithRetry(transcriptText, transcript.language);

        // Upsert summary (handle regenerate case)
        const existing = await this.summariesRepository.findOne({ where: { recordingId } });
        const summary = existing ?? this.summariesRepository.create({ recordingId });
        summary.tldr = parsed.tldr;
        summary.bulletsJson = parsed.bullets;
        summary.actionItemsJson = parsed.actionItems.map((a) => ({
            owner: a.owner ?? null,
            text: a.text,
            dueDate: a.dueDate ?? null,
        }));
        summary.chaptersJson = parsed.chapters;
        summary.keyDecisionsJson = parsed.keyDecisions;
        summary.model = SUMMARY_MODEL;
        summary.promptVersion = MEETING_SUMMARY_PROMPT_VERSION;
        await this.summariesRepository.save(summary);

        recording.summaryStatus = 'ready';
        await this.recordingsRepository.save(recording);
    }

    private buildTranscriptText(
        segments: Array<{ start: number; end: number; text: string }>,
    ): string {
        return segments
            .map((s) => `[${this.formatTimestamp(s.start)}] ${s.text}`)
            .join('\n');
    }

    private formatTimestamp(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    private async callClaudeWithRetry(
        transcriptText: string,
        language: string | null,
    ): Promise<z.infer<typeof SummarySchema>> {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await this.callClaude(transcriptText, language, attempt === 1);
            } catch (err) {
                lastError = err;
                this.logger.warn(`Claude attempt ${attempt + 1} failed: ${(err as Error).message}`);
            }
        }
        throw lastError ?? new Error('Claude summarization failed');
    }

    private async callClaude(
        transcriptText: string,
        language: string | null,
        stricter: boolean,
    ): Promise<z.infer<typeof SummarySchema>> {
        if (!this.anthropic) throw new Error('Anthropic not configured');

        const systemBlocks: Anthropic.TextBlockParam[] = [
            {
                type: 'text',
                text: MEETING_SUMMARY_SYSTEM,
                cache_control: { type: 'ephemeral' },
            } as any,
        ];
        if (stricter) {
            systemBlocks.push({
                type: 'text',
                text: 'IMPORTANT: Your previous response did not match the required tool schema. Respond ONLY by invoking the record_meeting_summary tool with all required fields. Do not include any other text.',
            } as any);
        }

        const langHint = language ? `\nThe transcript language is "${language}". Respond in that language.` : '';

        const response = await this.anthropic.messages.create({
            model: SUMMARY_MODEL,
            max_tokens: 2048,
            system: systemBlocks as any,
            tools: [RECORD_MEETING_SUMMARY_TOOL as any],
            tool_choice: { type: 'tool', name: RECORD_MEETING_SUMMARY_TOOL.name } as any,
            messages: [
                {
                    role: 'user',
                    content: `Here is the transcript (timestamps in [m:ss]):${langHint}\n\n${transcriptText}\n\nNow call record_meeting_summary.`,
                },
            ],
        });

        const toolUse = response.content.find(
            (b: any) => b.type === 'tool_use' && b.name === RECORD_MEETING_SUMMARY_TOOL.name,
        ) as any;
        if (!toolUse) {
            throw new Error('No tool_use block in Claude response');
        }
        return SummarySchema.parse(toolUse.input);
    }
}
