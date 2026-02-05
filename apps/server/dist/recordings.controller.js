"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingsController = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("./storage/storage.service");
const recordings_service_1 = require("./recordings.service");
const common_2 = require("@nestjs/common");
const jwt_auth_guard_1 = require("./auth/jwt-auth.guard");
let RecordingsController = class RecordingsController {
    storageService;
    recordingsService;
    constructor(storageService, recordingsService) {
        this.storageService = storageService;
        this.recordingsService = recordingsService;
    }
    async getUploadUrl(body) {
        const { fileName, contentType } = body;
        const uploadUrl = await this.storageService.getUploadPresignedUrl(fileName, contentType);
        return { uploadUrl, fileUrl: fileName };
    }
    async createRecording(body) {
        const fileUrl = body.fileUrl;
        if (!fileUrl) {
            throw new Error('fileUrl is required');
        }
        return this.recordingsService.create({
            title: body.title,
            fileUrl,
            type: body.type,
            userId: body.userId || body.guestId,
        });
    }
    async claimRecordings(req, body) {
        const userId = req.user.id;
        await this.recordingsService.claimRecordings(userId, body.recordingIds);
        return { success: true };
    }
    async getAllRecordings(req) {
        try {
            const userId = req.user.id;
            const recordings = await this.recordingsService.findAll(userId);
            return Promise.all(recordings.map(async (recording) => {
                try {
                    return {
                        ...recording,
                        fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
                    };
                }
                catch (err) {
                    console.error(`Failed to get signed URL for recording ${recording.id}:`, err);
                    return { ...recording, fileUrl: null };
                }
            }));
        }
        catch (error) {
            console.error('Error in getAllRecordings:', error);
            throw error;
        }
    }
    async getRecording(id) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording)
            return null;
        return {
            ...recording,
            fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
        };
    }
    async getDownloadUrl(fileName) {
        const url = await this.storageService.getDownloadUrl(fileName);
        return { url };
    }
};
exports.RecordingsController = RecordingsController;
__decorate([
    (0, common_1.Post)('upload-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getUploadUrl", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "createRecording", null);
__decorate([
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('claim'),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "claimRecordings", null);
__decorate([
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_2.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getAllRecordings", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getRecording", null);
__decorate([
    (0, common_1.Get)('download-url/:fileName'),
    __param(0, (0, common_1.Param)('fileName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getDownloadUrl", null);
exports.RecordingsController = RecordingsController = __decorate([
    (0, common_1.Controller)('recordings'),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        recordings_service_1.RecordingsService])
], RecordingsController);
//# sourceMappingURL=recordings.controller.js.map