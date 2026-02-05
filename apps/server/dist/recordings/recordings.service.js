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
var RecordingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recording_entity_1 = require("./entities/recording.entity");
const users_service_1 = require("../users/users.service");
let RecordingsService = RecordingsService_1 = class RecordingsService {
    recordingsRepository;
    usersService;
    logger = new common_1.Logger(RecordingsService_1.name);
    constructor(recordingsRepository, usersService) {
        this.recordingsRepository = recordingsRepository;
        this.usersService = usersService;
    }
    async create(createRecordingDto) {
        const recording = new recording_entity_1.Recording();
        recording.title = createRecordingDto.title;
        recording.fileUrl = createRecordingDto.fileUrl;
        recording.type = createRecordingDto.type;
        const userId = createRecordingDto.userId || createRecordingDto.guestId;
        if (userId) {
            recording.user = await this.usersService.findOrCreateBySupabaseId(userId);
        }
        return this.recordingsRepository.save(recording);
    }
    async findAll(userId) {
        if (userId) {
            return this.recordingsRepository.find({
                where: { user: { supabaseId: userId } },
                order: { createdAt: 'DESC' },
            });
        }
        return this.recordingsRepository.find({ order: { createdAt: 'DESC' } });
    }
    async findOne(id) {
        return this.recordingsRepository.findOne({ where: { id }, relations: ['user'] });
    }
    async claimRecordings(userId, recordingIds) {
        const user = await this.usersService.findOrCreateBySupabaseId(userId);
        if (recordingIds.length === 0) {
            return;
        }
        await this.recordingsRepository
            .createQueryBuilder()
            .update(recording_entity_1.Recording)
            .set({ user })
            .where('id IN (:...ids)', { ids: recordingIds })
            .execute();
    }
    async update(id, updateRecordingDto, userId) {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!recording) {
            throw new common_1.NotFoundException(`Recording with ID "${id}" not found`);
        }
        if (recording.user?.supabaseId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to update this recording');
        }
        if (updateRecordingDto.title) {
            recording.title = updateRecordingDto.title;
        }
        return this.recordingsRepository.save(recording);
    }
    async delete(id, userId) {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!recording) {
            throw new common_1.NotFoundException(`Recording with ID "${id}" not found`);
        }
        if (recording.user?.supabaseId !== userId) {
            throw new common_1.ForbiddenException('You do not have permission to delete this recording');
        }
        await this.recordingsRepository.remove(recording);
        return { success: true };
    }
};
exports.RecordingsService = RecordingsService;
exports.RecordingsService = RecordingsService = RecordingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recording_entity_1.Recording)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        users_service_1.UsersService])
], RecordingsService);
//# sourceMappingURL=recordings.service.js.map