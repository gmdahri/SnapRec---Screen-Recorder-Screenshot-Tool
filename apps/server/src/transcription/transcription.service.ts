import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { createReadStream, statSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import OpenAI from 'openai';
import { Transcript, TranscriptSegment } from './entities/transcript.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const WHISPER_MODEL = 'whisper-1';
const DEEPGRAM_MODEL = 'nova-2';
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const SILENCE_RATIO_THRESHOLD = 0.95;

@Injectable()
export class TranscriptionService {
    private readonly logger = new Logger(TranscriptionService.name);
    private readonly openai: OpenAI | null;
    private readonly deepgramKey: string | null;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Transcript)
        private readonly transcriptsRepository: Repository<Transcript>,
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        private readonly storageService: StorageService,
        private readonly subscriptionsService: SubscriptionsService,
    ) {
        const key = this.configService.get<string>('OPENAI_API_KEY');
        this.openai = key ? new OpenAI({ apiKey: key }) : null;
        this.deepgramKey = this.configService.get<string>('DEEPGRAM_API_KEY') || null;
        if (!this.openai && !this.deepgramKey) {
            this.logger.warn('Neither OPENAI_API_KEY nor DEEPGRAM_API_KEY configured — transcription disabled');
        }
        if (this.deepgramKey) {
            this.logger.log('Deepgram diarization enabled (nova-2)');
        }
    }

    /**
     * Transcribe a recording end-to-end. Mutates the Recording row's status fields.
     * Caller is responsible for flipping `transcriptStatus` to 'processing' beforehand.
     */
    async transcribe(recordingId: string): Promise<void> {
        if (!this.openai && !this.deepgramKey) {
            throw new Error('No transcription provider configured (set OPENAI_API_KEY or DEEPGRAM_API_KEY)');
        }
        const recording = await this.recordingsRepository.findOne({
            where: { id: recordingId },
            relations: ['user'],
        });
        if (!recording) throw new NotFoundException('Recording not found');

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'snaprec-'));
        const sourcePath = path.join(tmpDir, 'source.webm');
        const audioPath = path.join(tmpDir, 'audio.mp3');

        try {
            this.logger.log(`Downloading recording ${recordingId} (${recording.fileUrl})`);
            const { stream } = await this.storageService.getDownloadStream(recording.fileUrl);
            await this.writeStreamToFile(stream, sourcePath);

            this.logger.log(`Extracting audio with ffmpeg → ${audioPath}`);
            await this.runFfmpeg([
                '-y',
                '-i',
                sourcePath,
                '-vn',
                '-ac',
                '1',
                '-ar',
                '16000',
                '-b:a',
                '64k',
                audioPath,
            ]);

            const durationSec = await this.probeDuration(audioPath);
            recording.durationSec = Math.round(durationSec);

            const silenceRatio = await this.measureSilence(audioPath, durationSec);
            if (silenceRatio >= SILENCE_RATIO_THRESHOLD) {
                this.logger.log(
                    `Recording ${recordingId} is ${Math.round(silenceRatio * 100)}% silent — skipping Whisper`,
                );
                recording.transcriptStatus = 'skipped_silent';
                recording.summaryStatus = 'skipped_short';
                await this.recordingsRepository.save(recording);
                return;
            }

            const audioSize = statSync(audioPath).size;
            const allSegments: TranscriptSegment[] = [];
            let detectedLanguage: string | null = null;
            let rawFirst: any = null;
            let usedModel = WHISPER_MODEL;

            if (this.deepgramKey) {
                // Deepgram: single call with speaker diarization, no chunking needed
                const result = await this.callDeepgram(audioPath);
                rawFirst = result;
                detectedLanguage = result.language ?? null;
                allSegments.push(...result.segments);
                usedModel = DEEPGRAM_MODEL;
            } else if (audioSize <= WHISPER_MAX_BYTES) {
                const result = await this.callWhisper(audioPath);
                rawFirst = result;
                detectedLanguage = result.language ?? null;
                allSegments.push(...this.normalizeSegments(result.segments, 0));
            } else {
                const chunks = await this.splitAudioBySilence(audioPath, durationSec, tmpDir);
                for (const chunk of chunks) {
                    const result = await this.callWhisper(chunk.path);
                    if (!rawFirst) rawFirst = result;
                    if (!detectedLanguage && result.language) detectedLanguage = result.language;
                    allSegments.push(...this.normalizeSegments(result.segments, chunk.startSec));
                }
            }

            const transcript = this.transcriptsRepository.create({
                recordingId: recording.id,
                language: detectedLanguage,
                durationSec: recording.durationSec,
                segmentsJson: allSegments,
                rawProviderResponse: rawFirst,
                model: usedModel,
            });
            await this.transcriptsRepository.save(transcript);

            recording.transcriptStatus = 'ready';
            await this.recordingsRepository.save(recording);

            if (recording.user?.id && recording.durationSec) {
                await this.subscriptionsService.recordUsage(
                    recording.user.id,
                    recording.durationSec / 60,
                );
            }
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private async callWhisper(filePath: string): Promise<{
        language?: string;
        segments?: Array<{ start: number; end: number; text: string }>;
        text?: string;
    }> {
        if (!this.openai) throw new Error('OpenAI not configured');
        const file = createReadStream(filePath);
        // verbose_json returns segments with timestamps; segment granularity is the default.
        const result = await this.openai.audio.transcriptions.create({
            file,
            model: WHISPER_MODEL,
            response_format: 'verbose_json',
            temperature: 0,
        } as any);
        return result as any;
    }

    private async callDeepgram(filePath: string): Promise<{
        language: string | null;
        segments: TranscriptSegment[];
    }> {
        const audioBuffer = await fs.readFile(filePath);
        const url =
            `https://api.deepgram.com/v1/listen` +
            `?model=${DEEPGRAM_MODEL}&diarize=true&punctuate=true&smart_format=true&detect_language=true`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Token ${this.deepgramKey}`,
                'Content-Type': 'audio/mpeg',
            },
            body: audioBuffer,
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Deepgram error ${res.status}: ${body.slice(0, 300)}`);
        }

        const data: any = await res.json();
        const channel = data?.results?.channels?.[0];
        const alternative = channel?.alternatives?.[0];
        const language: string | null = channel?.detected_language ?? null;
        const paragraphs: any[] = alternative?.paragraphs?.paragraphs ?? [];

        const segments: TranscriptSegment[] = paragraphs.map((p: any) => ({
            start: p.start,
            end: p.end,
            text: (p.sentences ?? []).map((s: any) => s.text).join(' ').trim(),
            speaker: typeof p.speaker === 'number' ? p.speaker : undefined,
        }));

        return { language, segments };
    }

    private normalizeSegments(
        segs: Array<{ start: number; end: number; text: string }> | undefined,
        offsetSec: number,
    ): TranscriptSegment[] {
        if (!segs) return [];
        return segs.map((s) => ({
            start: s.start + offsetSec,
            end: s.end + offsetSec,
            text: (s.text || '').trim(),
        }));
    }

    private async writeStreamToFile(stream: NodeJS.ReadableStream, dest: string): Promise<void> {
        const fileHandle = await fs.open(dest, 'w');
        const writeStream = fileHandle.createWriteStream();
        await new Promise<void>((resolve, reject) => {
            stream.on('error', reject);
            writeStream.on('error', reject);
            writeStream.on('finish', () => resolve());
            stream.pipe(writeStream);
        });
        await fileHandle.close().catch(() => undefined);
    }

    private runFfmpeg(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args);
            let stderr = '';
            proc.stderr.on('data', (d) => {
                stderr += d.toString();
            });
            proc.on('error', reject);
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
            });
        });
    }

    private async probeDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffprobe', [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                filePath,
            ]);
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => {
                stdout += d.toString();
            });
            proc.stderr.on('data', (d) => {
                stderr += d.toString();
            });
            proc.on('error', reject);
            proc.on('close', (code) => {
                if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${stderr}`));
                const n = parseFloat(stdout.trim());
                if (!Number.isFinite(n)) return reject(new Error(`Unparseable duration: ${stdout}`));
                resolve(n);
            });
        });
    }

    /** Returns fraction of audio that is silent (0..1) using ffmpeg's silencedetect. */
    private async measureSilence(filePath: string, durationSec: number): Promise<number> {
        if (durationSec <= 0) return 1;
        return new Promise((resolve) => {
            const proc = spawn('ffmpeg', [
                '-i',
                filePath,
                '-af',
                'silencedetect=noise=-40dB:d=1',
                '-f',
                'null',
                '-',
            ]);
            let stderr = '';
            proc.stderr.on('data', (d) => {
                stderr += d.toString();
            });
            proc.on('close', () => {
                const re = /silence_duration:\s*([0-9.]+)/g;
                let total = 0;
                let m: RegExpExecArray | null;
                while ((m = re.exec(stderr)) !== null) {
                    total += parseFloat(m[1]);
                }
                resolve(Math.min(1, total / durationSec));
            });
            proc.on('error', () => resolve(0));
        });
    }

    /** Split into ≤20-min segments on time boundaries (silence-aware split is Phase 2). */
    private async splitAudioBySilence(
        audioPath: string,
        durationSec: number,
        tmpDir: string,
    ): Promise<Array<{ path: string; startSec: number }>> {
        const CHUNK_SEC = 20 * 60;
        const chunks: Array<{ path: string; startSec: number }> = [];
        let start = 0;
        let idx = 0;
        while (start < durationSec) {
            const out = path.join(tmpDir, `chunk-${idx}.mp3`);
            await this.runFfmpeg([
                '-y',
                '-i',
                audioPath,
                '-ss',
                String(start),
                '-t',
                String(CHUNK_SEC),
                '-acodec',
                'copy',
                out,
            ]);
            chunks.push({ path: out, startSec: start });
            start += CHUNK_SEC;
            idx += 1;
        }
        return chunks;
    }
}
