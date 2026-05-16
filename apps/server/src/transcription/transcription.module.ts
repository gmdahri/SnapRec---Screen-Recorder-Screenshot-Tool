import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transcript } from './entities/transcript.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { TranscriptionService } from './transcription.service';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Transcript, Recording]),
        StorageModule,
        SubscriptionsModule,
    ],
    providers: [TranscriptionService],
    exports: [TranscriptionService],
})
export class TranscriptionModule {}
