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
exports.RecordingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const recording_entity_1 = require("./entities/recording.entity");
const user_entity_1 = require("./entities/user.entity");
let RecordingsService = class RecordingsService {
    recordingsRepository;
    usersRepository;
    constructor(recordingsRepository, usersRepository) {
        this.recordingsRepository = recordingsRepository;
        this.usersRepository = usersRepository;
    }
    async create(data) {
        const recording = new recording_entity_1.Recording();
        recording.title = data.title;
        recording.fileUrl = data.fileUrl;
        recording.type = data.type;
        if (data.userId) {
            let user = await this.usersRepository.findOne({ where: { supabaseId: data.userId } });
            if (!user) {
                user = new user_entity_1.User();
                user.supabaseId = data.userId;
                await this.usersRepository.save(user);
            }
            recording.user = user;
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
        const user = await this.usersRepository.findOne({ where: { supabaseId: userId } });
        if (!user)
            throw new Error('User not found');
        await this.recordingsRepository
            .createQueryBuilder()
            .update(recording_entity_1.Recording)
            .set({ user })
            .where('id IN (:...ids)', { ids: recordingIds })
            .execute();
    }
};
exports.RecordingsService = RecordingsService;
exports.RecordingsService = RecordingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(recording_entity_1.Recording)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RecordingsService);
//# sourceMappingURL=recordings.service.js.map