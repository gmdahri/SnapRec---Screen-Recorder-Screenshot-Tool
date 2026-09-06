import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UploadPolicyService } from '../storage/upload-policy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VideoProjectsService } from './video-projects.service';
import { CreateVideoProjectDto } from './dto/create-video-project.dto';
import { UpdateVideoProjectDto } from './dto/update-video-project.dto';

@Controller('video-projects')
@UseGuards(JwtAuthGuard)
export class VideoProjectsController {
  constructor(private readonly service: VideoProjectsService, private readonly uploads: UploadPolicyService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateVideoProjectDto) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  list(@Req() req: any) {
    return this.service.findAll(req.user.id);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch(':id')
  async patch(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVideoProjectDto,
  ) {
    if (dto.newFileUrl) await this.uploads.assertOwned(dto.newFileUrl, `user:${req.user.id}`);
    return this.service.update(id, dto, req.user.id);
  }
}
