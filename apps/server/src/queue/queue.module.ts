import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recording } from '../recordings/entities/recording.entity';
import { Transcript } from '../transcription/entities/transcript.entity';
import { Summary } from '../ai/entities/summary.entity';
import { TranscriptionModule } from '../transcription/transcription.module';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { AiPipelineQueue } from './ai-pipeline.queue';
import { AiPipelineWorker } from './ai-pipeline.worker';

@Module({
    imports: [
        TypeOrmModule.forFeature([Recording, Transcript, Summary]),
        forwardRef(() => TranscriptionModule),
        forwardRef(() => AiModule),
        MailModule,
    ],
    providers: [AiPipelineQueue, AiPipelineWorker],
    exports: [AiPipelineQueue],
})
export class QueueModule {}
