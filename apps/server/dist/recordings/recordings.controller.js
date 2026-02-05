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
var RecordingsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingsController = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("../storage/storage.service");
const recordings_service_1 = require("./recordings.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const dto_1 = require("./dto");
let RecordingsController = RecordingsController_1 = class RecordingsController {
    storageService;
    recordingsService;
    logger = new common_1.Logger(RecordingsController_1.name);
    constructor(storageService, recordingsService) {
        this.storageService = storageService;
        this.recordingsService = recordingsService;
    }
    async getUploadUrl(uploadUrlDto) {
        const uploadUrl = await this.storageService.getUploadPresignedUrl(uploadUrlDto.fileName, uploadUrlDto.contentType);
        return { uploadUrl, fileUrl: uploadUrlDto.fileName };
    }
    async createRecording(createRecordingDto) {
        return this.recordingsService.create(createRecordingDto);
    }
    async claimRecordings(req, claimRecordingsDto) {
        await this.recordingsService.claimRecordings(req.user.id, claimRecordingsDto.recordingIds);
        return { success: true };
    }
    async getAllRecordings(req) {
        const recordings = await this.recordingsService.findAll(req.user.id);
        return Promise.all(recordings.map(async (recording) => {
            try {
                return {
                    ...recording,
                    fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
                };
            }
            catch (err) {
                this.logger.error(`Failed to get signed URL for recording ${recording.id}:`, err);
                return { ...recording, fileUrl: null };
            }
        }));
    }
    async getRecording(id) {
        const recording = await this.recordingsService.findOne(id);
        if (!recording) {
            throw new common_1.NotFoundException(`Recording with ID "${id}" not found`);
        }
        return {
            ...recording,
            fileUrl: await this.storageService.getDownloadUrl(recording.fileUrl),
        };
    }
    async getDownloadUrl(fileName) {
        const url = await this.storageService.getDownloadUrl(fileName);
        return { url };
    }
    async updateRecording(id, updateRecordingDto, req) {
        return this.recordingsService.update(id, updateRecordingDto, req.user.id);
    }
    async deleteRecording(id, req) {
        return this.recordingsService.delete(id, req.user.id);
    }
};
exports.RecordingsController = RecordingsController;
__decorate([
    (0, common_1.Post)('upload-url'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.UploadUrlDto]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getUploadUrl", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateRecordingDto]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "createRecording", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('claim'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.ClaimRecordingsDto]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "claimRecordings", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "getAllRecordings", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
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
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateRecordingDto, Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "updateRecording", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RecordingsController.prototype, "deleteRecording", null);
exports.RecordingsController = RecordingsController = RecordingsController_1 = __decorate([
    (0, common_1.Controller)('recordings'),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        recordings_service_1.RecordingsService])
], RecordingsController);
//# sourceMappingURL=recordings.controller.js.map