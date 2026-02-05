import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { Recording } from './entities/recording.entity';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Recording]),
        UsersModule,
        StorageModule,
    ],
    controllers: [RecordingsController],
    providers: [RecordingsService],
    exports: [RecordingsService],
})
export class RecordingsModule { }
