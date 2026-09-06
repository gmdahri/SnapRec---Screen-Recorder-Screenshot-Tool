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
import { UploadPolicyService, uploadPrincipal, guestPrincipal } from '../storage/upload-policy.service';
import { IsUUID } from 'class-validator';
class QualifiedViewDto { @IsUUID() sessionId: string; }
const profile = (user: any) => user ? { supabaseId: user.supabaseId, fullName: user.fullName, avatarUrl: user.avatarUrl } : undefined;
const publicRecording = (recording: any) => ({
    ...recording, guestId: undefined, user: profile(recording.user),
    comments: (recording.comments || []).map((comment: any) => ({ ...comment, user: profile(comment.user) })),
    reactions: (recording.reactions || []).map((reaction: any) => ({ ...reaction, user: profile(reaction.user) })),
});

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
        private readonly uploads: UploadPolicyService,
    ) { }

    @UseGuards(OptionalJwtAuthGuard)
    @Post('upload-url')
    async getUploadUrl(@Req() req: any, @Body() dto: UploadUrlDto) {
        return this.uploads.issue(req, dto.contentType, dto.sizeBytes);
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Post()
    async createRecording(@Req() req: any, @Body() createRecordingDto: CreateRecordingDto) {
        const principal = uploadPrincipal(req);
        await this.uploads.assertOwned(createRecordingDto.fileUrl, principal);
        createRecordingDto.userId = req.user?.id;
        createRecordingDto.guestId = req.user ? undefined : principal;
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
            guestPrincipal(req),
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

    @UseGuards(OptionalJwtAuthGuard)
    @Get('status/:fileName')
    async getFileStatus(@Req() req: any, @Param('fileName') fileName: string, @Res({ passthrough: true }) res: Response) {
        await this.recordingsService.assertFileAccess(fileName, req.user?.id);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        const exists = await this.storageService.checkFileExists(fileName);
        return { ready: exists };
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Get('stream/:fileName')
    async streamFile(
        @Req() req: any,
        @Param('fileName') fileName: string,
        @Res() res: Response,
    ) {
        await this.recordingsService.assertFileAccess(fileName, req.user?.id);
        res.set('Cache-Control', 'no-store');
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

    @UseGuards(OptionalJwtAuthGuard)
    @Get(':id')
    async getRecording(@Req() req: any, @Res({ passthrough: true }) res: Response, @Param('id', ParseUUIDPipe) id: string) {
        res.set('Cache-Control', 'no-store');
        const recording = await this.recordingsService.assertAccess(id, req.user?.id);
        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        const isReady = await this.storageService.checkFileExists(recording.fileUrl);

        return {
            ...publicRecording(recording),
            isReady,
            fileUrl: isReady
                ? await this.storageService.getDownloadUrl(recording.fileUrl)
                : recording.fileUrl,
            // Null when no signed-in viewer has watched — the viewer hides the
            // tile rather than showing 0%.
            watchedPercent: await this.recordingsService.watchedPercent(id),
        };
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Get('download-url/:fileName')
    async getDownloadUrl(@Req() req: any, @Param('fileName') fileName: string) {
        await this.recordingsService.assertFileAccess(fileName, req.user?.id);
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
        if (updateRecordingDto.fileUrl) await this.uploads.assertOwned(updateRecordingDto.fileUrl, uploadPrincipal(req));
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
        await this.recordingsService.assertAccess(id, req.user?.id);
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
        await this.recordingsService.assertAccess(id, req.user?.id);
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
        await this.recordingsService.assertAccess(id, req.user?.id);
        return this.recordingsService.recordWatchProgress(id, dto.ranges, req.user?.id, userMeta);
    }

    @UseGuards(OptionalJwtAuthGuard)
    @Post(':id/view')
    async qualifiedView(@Param('id', ParseUUIDPipe) id: string, @Body() dto: QualifiedViewDto, @Req() req: any) {
        return this.recordingsService.recordQualifiedView(id, dto.sessionId, req.user?.id);
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
        await this.uploads.assertOwned(dto.fileUrl, uploadPrincipal(req));
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
        await this.recordingsService.assertAccess(id, req.user?.id);
        return this.recordingsService.setCommentResolved(
            id, commentId, dto.resolved ?? true, req.user?.id, userMeta,
        );
    }
}
