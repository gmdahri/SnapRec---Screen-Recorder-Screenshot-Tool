import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VideoProject } from './entities/video-project.entity';
import { Recording } from '../recordings/entities/recording.entity';
import { UsersService } from '../users/users.service';
import { CreateVideoProjectDto } from './dto/create-video-project.dto';
import { UpdateVideoProjectDto } from './dto/update-video-project.dto';
import { RecordingsService } from '../recordings/recordings.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class VideoProjectsService {
  private readonly logger = new Logger(VideoProjectsService.name);

  constructor(
    @InjectRepository(VideoProject)
    private readonly projectRepo: Repository<VideoProject>,
    @InjectRepository(Recording)
    private readonly recordingRepo: Repository<Recording>,
    private readonly usersService: UsersService,
    private readonly recordingsService: RecordingsService,
    private readonly storageService: StorageService,
  ) {}

  private streamPath(fileUrl: string) {
    return `/recordings/stream/${fileUrl}`;
  }

  async create(dto: CreateVideoProjectDto, supabaseUserId: string) {
    const recording = await this.recordingRepo.findOne({
      where: { id: dto.recordingId },
      relations: ['user'],
    });
    if (!recording) throw new NotFoundException('Recording not found');
    if (!recording.user?.supabaseId) {
      throw new ForbiddenException('Recording has no owner; save/upload while signed in first.');
    }
    if (recording.user.supabaseId !== supabaseUserId) {
      throw new ForbiddenException('Recording not owned by you');
    }

    const user = await this.usersService.findOrCreateBySupabaseId(supabaseUserId);

    const existing = await this.projectRepo.findOne({
      where: { user: { id: user.id }, sourceRecording: { id: recording.id } },
      relations: ['sourceRecording'],
    });
    if (existing?.sourceRecording) {
      return await this.toResponse(
        existing.id,
        existing.title,
        recording.id,
        existing.sourceRecording.fileUrl,
        existing.timelineJson,
        existing.updatedAt,
      );
    }

    const title = dto.title?.trim() || `Edit — ${new Date().toLocaleString()}`;

    // Explicit INSERT avoids TypeORM relation persistence edge cases and surfaces DB errors clearly.
    const id = randomUUID();
    try {
      await this.projectRepo.manager.query(
        `INSERT INTO "sr_video_projects" ("id","userId","sourceRecordingId","title","timelineJson","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,NULL,NOW(),NOW())`,
        [id, user.id, recording.id, title],
      );
    } catch (err: unknown) {
      const any = err as { code?: string; message?: string };
      this.logger.error(`POST /video-projects insert failed: ${any?.message}`, any);
      if (any?.code === '42P01' || String(any?.message).includes('sr_video_projects')) {
        throw new ServiceUnavailableException(
          'Video projects storage is not ready. Run DB migrations (sr_video_projects), e.g. `npx typeorm migration:run -d src/data-source.ts` in apps/server.',
        );
      }
      if (any?.code === '23503') {
        throw new NotFoundException('Recording or user reference invalid');
      }
      throw err;
    }

    return await this.toResponse(id, title, recording.id, recording.fileUrl);
  }

  async findAll(supabaseUserId: string) {
    const user = await this.usersService.findOrCreateBySupabaseId(supabaseUserId);
    const list = await this.projectRepo.find({
      where: { user: { id: user.id } },
      relations: ['sourceRecording'],
      order: { updatedAt: 'DESC' },
    });
    const out = [];
    for (const p of list) {
      out.push(
        await this.toResponse(
          p.id,
          p.title,
          p.sourceRecording.id,
          p.sourceRecording.fileUrl,
          p.timelineJson,
          p.updatedAt,
        ),
      );
    }
    return out;
  }

  async findOne(projectId: string, supabaseUserId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['user', 'sourceRecording'],
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.user.supabaseId !== supabaseUserId) {
      throw new ForbiddenException('Not your project');
    }
    return await this.toResponse(
      project.id,
      project.title,
      project.sourceRecording.id,
      project.sourceRecording.fileUrl,
      project.timelineJson,
      project.updatedAt,
    );
  }

  async update(projectId: string, dto: UpdateVideoProjectDto, supabaseUserId: string) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['user', 'sourceRecording'],
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.user.supabaseId !== supabaseUserId) {
      throw new ForbiddenException('Not your project');
    }
    if (dto.title != null) project.title = dto.title;
    if (dto.timelineJson != null) project.timelineJson = dto.timelineJson;
    await this.projectRepo.save(project);

    if (dto.newFileUrl?.trim()) {
      await this.recordingsService.update(
        project.sourceRecording.id,
        { fileUrl: dto.newFileUrl.trim() },
        supabaseUserId,
      );
      const rec = await this.recordingRepo.findOne({
        where: { id: project.sourceRecording.id },
      });
      if (rec) project.sourceRecording = rec;
    }

    return await this.toResponse(
      project.id,
      project.title,
      project.sourceRecording.id,
      project.sourceRecording.fileUrl,
      project.timelineJson,
      project.updatedAt,
    );
  }

  private async toResponse(
    id: string,
    title: string,
    recordingId: string,
    fileUrl: string,
    timelineJson?: Record<string, unknown> | null,
    updatedAt?: Date,
  ) {
    const fileSizeBytes = await this.storageService.getContentLength(fileUrl);
    return {
      id,
      title,
      recordingId,
      fileUrl,
      videoUrl: this.streamPath(fileUrl),
      timelineJson: timelineJson ?? null,
      updatedAt: updatedAt?.toISOString?.() ?? null,
      fileSizeBytes,
    };
  }
}
