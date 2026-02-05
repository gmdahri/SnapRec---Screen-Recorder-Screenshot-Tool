import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { RecordingsService } from './recordings.service';
import { UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('recordings')
export class RecordingsController {
    constructor(
        private readonly storageService: StorageService,
        private readonly recordingsService: RecordingsService,
    ) { }

    @Post('upload-url')
    async getUploadUrl(@Body() body: { fileName: string; contentType: string }) {
        const { fileName, contentType } = body;
        const url = await this.storageService.getUploadPresignedUrl(fileName, contentType);
        return { url, fileName };
    }

    @Post()
    async createRecording(@Body() body: {
        title: string;
        fileName: string;
        type: 'video' | 'screenshot';
        userId?: string;
    }) {
        // Construct the actual file URL (this depends on Cloudflare R2 public URL or signed URL logic)
        // For now, we'll store the fileName or a simulated public URL
        const fileUrl = body.fileName;

        return this.recordingsService.create({
            title: body.title,
            fileUrl,
            type: body.type,
            userId: body.userId,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('claim')
    async claimRecordings(@Req() req: any, @Body() body: { recordingIds: string[] }) {
        const userId = req.user.id;
        await this.recordingsService.claimRecordings(userId, body.recordingIds);
        return { success: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getAllRecordings(@Req() req: any) {
        const userId = req.user.id;
        const recordings = await this.recordingsService.findAll(userId);

        // Add signed URLs to each recording for the dashboard thumbnails/previews
        return Promise.all(recordings.map(async (recording) => ({
            ...recording,
            fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
        })));
    }

    @Get(':id')
    async getRecording(@Param('id') id: string) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording) return null;

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
}
