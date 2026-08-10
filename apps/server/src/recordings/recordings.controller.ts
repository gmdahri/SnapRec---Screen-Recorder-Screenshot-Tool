import {
    Controller,
    Query,
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
} from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { PublishRecordingDto } from './dto/publish-recording.dto';
import { WatchProgressDto } from './dto/watch-progress.dto';
import { UploadUrlDto, CreateRecordingDto, UpdateRecordingDto, ClaimRecordingsDto, AddReactionDto, AddCommentDto, SharedQueryDto } from './dto';

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
        const userMeta = req.user ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl } : undefined;
        return this.recordingsService.create(createRecordingDto, userMeta);
    }

    @UseGuards(JwtAuthGuard)
    @Post('claim')
    async claimRecordings(@Req() req: any, @Body() claimRecordingsDto: ClaimRecordingsDto) {
        const userMeta = { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl };
        const { claimed } = await this.recordingsService.claimRecordings(
            req.user.id,
            claimRecordingsDto.recordingIds,
            userMeta,
            claimRecordingsDto.guestId,
        );
        return { success: true, claimed };
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getAllRecordings(@Req() req: any) {
        this.logger.log(`Fetching recordings for user ${req.user.id}`);
        const start = Date.now();
        const recordings = await this.recordingsService.findAll(req.user.id);
        const end = Date.now();
        this.logger.log(`Found ${recordings.length} recordings in ${end - start}ms`);

        return Promise.all(recordings.map(async (recording) => ({
            ...recording,
            // Send the browser directly to R2. The API no longer proxies video bytes.
            fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
        })));
    }

    /** Declared BEFORE @Get(':id') — Nest matches routes in declaration order,
     * so a later definition would be swallowed by the id param and 404. */
    @UseGuards(JwtAuthGuard)
    @Get('shared')
    async getShared(@Req() req: any, @Query() query: SharedQueryDto) {
        return this.recordingsService.findShared(req.user.id, query.direction ?? 'by-me');
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
        @Res() res: Response,
    ) {
        try {
            // Keep old links working without sending the file through this service.
            const url = await this.storageService.getDownloadUrl(fileName);
            return res.redirect(302, url);
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

        const isReady = await this.storageService.checkFileExists(recording.fileUrl);

        return {
            ...recording,
            isReady,
            fileUrl: isReady
                ? await this.storageService.getDownloadUrl(recording.fileUrl)
                : recording.fileUrl,
            // Null when no signed-in viewer has watched — the viewer hides the
            // tile rather than showing 0%.
            watchedPercent: await this.recordingsService.watchedPercent(id),
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
        const userMeta = req.user ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl } : undefined;
        return this.recordingsService.addReaction(
            id,
            addReactionDto.type,
            req.user?.id,
            addReactionDto.guestId,
            userMeta,
        );
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Post(':id/comments')
    async addComment(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() addCommentDto: AddCommentDto,
        @Req() req: any,
    ) {
        const userMeta = req.user ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl } : undefined;
        return this.recordingsService.addComment(
            id,
            addCommentDto.content,
            req.user?.id,
            addCommentDto.guestId,
            userMeta,
            // The anchor the DTO has always validated. It used to stop here.
            {
                timecodeMs: addCommentDto.timecodeMs,
                anchorX: addCommentDto.anchorX,
                anchorY: addCommentDto.anchorY,
            },
        );
    }

    /** Heartbeat of what a viewer has watched (P7 V4).
     *
     * OptionalJwtAuthGuard, not the strict one: this page is public and a guest
     * hitting it must not see an error. Their call is accepted and discarded —
     * no per-person row is created for anyone who is not signed in. */
    @UseGuards(OptionalJwtAuthGuard)
    @Post(':id/progress')
    async recordProgress(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: WatchProgressDto,
        @Req() req: any,
    ) {
        const userMeta = req.user
            ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl }
            : undefined;
        return this.recordingsService.recordWatchProgress(id, dto.ranges, req.user?.id, userMeta);
    }

    /** Replace the media behind a recording, keeping its link and comments.
     *
     * Owner only, and never anonymous: this overwrites what everyone holding
     * the link already has. */
    @UseGuards(JwtAuthGuard)
    @Post(':id/publish')
    async publishRecording(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: PublishRecordingDto,
        @Req() req: any,
    ) {
        return this.recordingsService.publish(id, dto, req.user.id);
    }

    /** Settle or reopen a comment. JwtAuthGuard, not the optional one: a guestId
     * is readable by anyone with the share link, so it cannot authorise closing
     * someone else's question. */
    @UseGuards(JwtAuthGuard)
    @Patch(':id/comments/:commentId/resolve')
    async resolveComment(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('commentId', ParseUUIDPipe) commentId: string,
        @Body() dto: ResolveCommentDto,
        @Req() req: any,
    ) {
        const userMeta = req.user
            ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl }
            : undefined;
        return this.recordingsService.setCommentResolved(
            id, commentId, dto.resolved ?? true, req.user?.id, userMeta,
        );
    }
}
