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
    Res,
    ParseUUIDPipe,
    Logger,
    NotFoundException,
    StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { UploadUrlDto, CreateRecordingDto, UpdateRecordingDto, ClaimRecordingsDto, AddReactionDto, AddCommentDto } from './dto';

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

        return recordings.map((recording) => ({
            ...recording,
            fileUrl: `/recordings/stream/${recording.fileUrl}`,
        }));
    }

    @Get('status/:fileName')
    async getFileStatus(@Param('fileName') fileName: string, @Res({ passthrough: true }) res: Response) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        const exists = await this.storageService.checkFileExists(fileName);
        return { ready: exists };
    }

    @Get('stream/:fileName')
    async streamFile(
        @Param('fileName') fileName: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        try {
            const { stream, contentType, contentLength } = await this.storageService.getDownloadStream(fileName);

            const headers: any = {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
            };

            if (req.method === 'OPTIONS') {
                res.status(200).set(headers).send();
                return;
            }

            // Support forceful download via query param
            const isDownload = (req.query as any).download === 'true';
            headers['Content-Disposition'] = isDownload
                ? `attachment; filename="${fileName}"`
                : `inline; filename="${fileName}"`;

            res.set(headers);
            return new StreamableFile(stream);
        } catch (err) {
            if (err.Code === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                this.logger.warn(`File ${fileName} not yet available for streaming (NoSuchKey)`);
            } else {
                this.logger.error(`Failed to stream file ${fileName}:`, err);
            }
            throw new NotFoundException(`File ${fileName} not found`);
        }
    }

    @Get(':id')
    async getRecording(@Param('id', ParseUUIDPipe) id: string) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        return {
            ...recording,
            fileUrl: `/recordings/stream/${recording.fileUrl}`,
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
    @UseGuards(OptionalJwtAuthGuard)
    @Post(':id/reactions')
    async addReaction(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() addReactionDto: AddReactionDto,
        @Req() req: any,
    ) {
        return this.recordingsService.addReaction(
            id,
            addReactionDto.type,
            req.user?.id,
            addReactionDto.guestId,
        );
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Post(':id/comments')
    async addComment(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() addCommentDto: AddCommentDto,
        @Req() req: any,
    ) {
        return this.recordingsService.addComment(
            id,
            addCommentDto.content,
            req.user?.id,
            addCommentDto.guestId,
        );
    }
}
