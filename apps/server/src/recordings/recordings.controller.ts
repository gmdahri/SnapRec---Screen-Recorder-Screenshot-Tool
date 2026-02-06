import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Patch,
    Delete,
    UseGuards,
    Req,
    ParseUUIDPipe,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { UploadUrlDto, CreateRecordingDto, UpdateRecordingDto, ClaimRecordingsDto } from './dto';

@Controller('recordings')
export class RecordingsController {
    private readonly logger = new Logger(RecordingsController.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly recordingsService: RecordingsService,
    ) { }

    @Post('upload-url')
    async getUploadUrl(@Body() uploadUrlDto: UploadUrlDto) {
        const uploadUrl = await this.storageService.getUploadPresignedUrl(
            uploadUrlDto.fileName,
            uploadUrlDto.contentType,
        );
        return { uploadUrl, fileUrl: uploadUrlDto.fileName };
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Post()
    async createRecording(@Req() req: any, @Body() createRecordingDto: CreateRecordingDto) {
        if (req.user && !createRecordingDto.userId) {
            createRecordingDto.userId = req.user.id;
        }
        return this.recordingsService.create(createRecordingDto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('claim')
    async claimRecordings(@Req() req: any, @Body() claimRecordingsDto: ClaimRecordingsDto) {
        await this.recordingsService.claimRecordings(req.user.id, claimRecordingsDto.recordingIds);
        return { success: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getAllRecordings(@Req() req: any) {
        const recordings = await this.recordingsService.findAll(req.user.id);

        return Promise.all(
            recordings.map(async (recording) => {
                try {
                    return {
                        ...recording,
                        fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
                    };
                } catch (err) {
                    this.logger.error(`Failed to get signed URL for recording ${recording.id}:`, err);
                    return { ...recording, fileUrl: null };
                }
            }),
        );
    }

    @Get(':id')
    async getRecording(@Param('id', ParseUUIDPipe) id: string) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        return {
            ...recording,
            fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
        };
    }

    @Get('download-url/:fileName')
    async getDownloadUrl(@Param('fileName') fileName: string) {
        const url = await this.storageService.getDownloadUrl(fileName);
        return { url };
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateRecording(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateRecordingDto: UpdateRecordingDto,
        @Req() req: any,
    ) {
        return this.recordingsService.update(id, updateRecordingDto, req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async deleteRecording(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.recordingsService.delete(id, req.user.id);
    }
}
