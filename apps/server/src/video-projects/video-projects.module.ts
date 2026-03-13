import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoProject } from './entities/video-project.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { VideoProjectsController } from './video-projects.controller';
import { VideoProjectsService } from './video-projects.service';
import { UsersModule } from '../users/users.module';
import { RecordingsModule } from '../recordings/recordings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideoProject, Recording]),
    UsersModule,
    RecordingsModule,
  ],
  controllers: [VideoProjectsController],
  providers: [VideoProjectsService],
  exports: [VideoProjectsService],
})
export class VideoProjectsModule {}
