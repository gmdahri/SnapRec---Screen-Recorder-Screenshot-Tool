import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { Transcript } from '../transcription/entities/transcript.entity';
import { Summary } from '../ai/entities/summary.entity';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { AiModule } from '../ai/ai.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Recording, Reaction, Comment, Transcript, Summary]),
        UsersModule,
        StorageModule,
        TranscriptionModule,
        AiModule,
        SubscriptionsModule,
        MailModule,
    ],
    controllers: [RecordingsController],
    providers: [RecordingsService],
    exports: [RecordingsService],
})
export class RecordingsModule { }
