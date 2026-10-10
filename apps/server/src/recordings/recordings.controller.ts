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
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { LenientJwtAuthGuard } from '../auth/lenient-jwt-auth.guard';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { PublishRecordingDto } from './dto/publish-recording.dto';
import { WatchProgressDto } from './dto/watch-progress.dto';
import { UploadUrlDto, CreateRecordingDto, UpdateRecordingDto, ClaimRecordingsDto, AddReactionDto, AddCommentDto, SharedQueryDto, BeginUploadDto, PartUrlDto, CompleteUploadDto, AbortUploadDto } from './dto';

@Controller('recordings')
export class RecordingsController {
    private readonly logger = new Logger(RecordingsController.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly recordingsService: RecordingsService,
    ) { }

    /** Every upload endpoint below signs a key the client names, with no
     * account required — guests upload too. What they must never do is sign
     * a key that already holds a file: keys are readable by anyone holding a
     * share link, so that was a way to replace anybody's recording. Every
     * legitimate uploader names a fresh key. */
    private async refuseExistingKey(fileName: string) {
        if (await this.storageService.checkFileExists(fileName)) {
            throw new ConflictException('A file already exists at this key');
        }
    }

    @Post('upload-url')
    async getUploadUrl(@Body() uploadUrlDto: UploadUrlDto) {
        await this.refuseExistingKey(uploadUrlDto.fileName);
        const uploadUrl = await this.storageService.getUploadPresignedUrl(
            uploadUrlDto.fileName,
            uploadUrlDto.contentType,
        );
        return { uploadUrl, fileUrl: uploadUrlDto.fileName };
    }

    /* ── Streaming upload ────────────────────────────────────────────────────
     * A recording is uploaded while it is still being made: the extension opens
     * an upload here, asks for a signed URL per 5 MB part, PUTs each part
     * straight to R2, and completes at the end. Part bytes never reach this
     * server — it only signs and bookkeeps. */

    @Post('upload/begin')
    async beginUpload(@Body() dto: BeginUploadDto) {
        await this.refuseExistingKey(dto.fileName);
        const uploadId = await this.storageService.createMultipartUpload(
            dto.fileName, dto.contentType);
        return { uploadId };
    }

    @Post('upload/part')
    async getPartUrl(@Body() dto: PartUrlDto) {
        const uploadUrl = await this.storageService.getUploadPartUrl(
            dto.fileName, dto.uploadId, dto.partNumber);
        return { uploadUrl };
    }

    @Post('upload/complete')
    async completeUpload(@Body() dto: CompleteUploadDto) {
        // Checked again here: completing is what writes the object, and the
        // key may have been filled since the upload was opened.
        await this.refuseExistingKey(dto.fileName);
        await this.storageService.completeMultipartUpload(
            dto.fileName, dto.uploadId, dto.parts);
        return { fileUrl: dto.fileName };
    }

    /** Abort is what stops orphaned parts billing. It must never throw at the
     * caller: the extension calls this on cancel and on suspend, when it may
     * have milliseconds to live and no way to react to a failure. */
    @Post('upload/abort')
    async abortUpload(@Body() dto: AbortUploadDto) {
        try {
            await this.storageService.abortMultipartUpload(dto.fileName, dto.uploadId);
        } catch (e) {
            this.logger.warn(`Abort failed for ${dto.fileName}: ${(e as Error).message}`);
        }
        return { aborted: true };
    }

    /** Called by Cloud Scheduler every five minutes.
     *
     * Guarded by a shared secret rather than a user token: there is no user.
     * Cloud Run scales to zero, so an in-process cron would simply not run —
     * the schedule has to come from outside.
     *
     * Answers 404 rather than 401 when the secret is wrong or unset, so the
     * endpoint does not advertise its own existence. */
    @Post('sweep-expired')
    async sweepExpired(@Req() req: any) {
        const expected = process.env.SWEEP_SECRET;
        if (!expected || req.headers['x-sweep-secret'] !== expected) {
            throw new NotFoundException();
        }
        const result = await this.recordingsService.sweepExpired();
        if (result.deleted) this.logger.log(`Sweep deleted ${result.deleted} expired recordings`);
        return result;
    }

    /** 201 for a new recording; 200 with the existing row for a retry of
     * one; 409 for an id that is someone else's. See RecordingsService.create.
     *
     * Ownership comes from the token and nowhere else. A body userId used to
     * be taken at its word, so an anonymous caller could create recordings in
     * anyone's library. It is still accepted when it names the caller — the
     * web app sends one alongside its token — and refused otherwise. */
    @UseGuards(OptionalJwtAuthGuard)
    @Post()
    async createRecording(
        @Req() req: any,
        @Body() createRecordingDto: CreateRecordingDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (createRecordingDto.userId && createRecordingDto.userId !== req.user?.id) {
            throw new ForbiddenException('userId does not match the signed-in user');
        }
        createRecordingDto.userId = req.user?.id;
        const userMeta = req.user ? { email: req.user.email, fullName: req.user.fullName, avatarUrl: req.user.avatarUrl } : undefined;
        const { recording, created } = await this.recordingsService.create(createRecordingDto, userMeta);
        if (!created) res.status(200);
        return recording;
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

    @UseGuards(LenientJwtAuthGuard)
    @Get(':id')
    async getRecording(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        const isReady = await this.storageService.checkFileExists(recording.fileUrl);

        return {
            ...RecordingsController.publicView(recording, req.user?.id),
            isReady,
            fileUrl: isReady
                ? await this.storageService.getDownloadUrl(recording.fileUrl)
                : recording.fileUrl,
            // Null when no signed-in viewer has watched — the viewer hides the
            // tile rather than showing 0%.
            watchedPercent: await this.recordingsService.watchedPercent(id),
        };
    }

    /** The recording as anyone holding its link may see it.
     *
     * People are a display name and an avatar — nothing else. This used to
     * return each person's full user row: email, internal id, auth id. And no
     * guestId at all: a guestId is the only proof a guest has that a capture
     * is theirs (claiming requires it), and this endpoint answers anyone.
     *
     * What the page used to work out by comparing ids it now gets as flags,
     * computed here against the viewer's token: whether they own the
     * recording, wrote a comment, or left a reaction. `byOwner` does not
     * depend on the viewer; it is what "needs a reply" is decided from. */
    static publicView(recording: any, viewerSupabaseId?: string) {
        const person = (u?: { fullName?: string | null; avatarUrl?: string | null } | null) =>
            (u ? { fullName: u.fullName ?? null, avatarUrl: u.avatarUrl ?? null } : null);
        const isViewer = (u?: { supabaseId?: string } | null) =>
            !!viewerSupabaseId && u?.supabaseId === viewerSupabaseId;
        const { guestId: _guestId, user, reactions, comments, ...rest } = recording;
        return {
            ...rest,
            user: person(user),
            viewerIsOwner: isViewer(user),
            reactions: reactions?.map(({ guestId: _g, user: u, ...reaction }: any) => ({
                ...reaction, user: person(u), viewerReacted: isViewer(u),
            })),
            comments: comments?.map(({ guestId: _g, user: u, resolvedByUserId: _r, ...comment }: any) => ({
                ...comment,
                user: person(u),
                byOwner: !!u && !!user && u.id === user.id,
                viewerIsAuthor: isViewer(u),
            })),
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
