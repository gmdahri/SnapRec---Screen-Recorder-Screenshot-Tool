import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Summary } from './entities/summary.entity';
import { Transcript } from '../transcription/entities/transcript.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { AiSummaryService } from './ai-summary.service';

@Module({
    imports: [TypeOrmModule.forFeature([Summary, Transcript, Recording])],
    providers: [AiSummaryService],
    exports: [AiSummaryService],
})
export class AiModule {}
