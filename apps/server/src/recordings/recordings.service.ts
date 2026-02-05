import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';

@Injectable()
export class RecordingsService {
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        private readonly usersService: UsersService,
    ) { }

    async create(createRecordingDto: CreateRecordingDto): Promise<Recording> {
        const recording = new Recording();
        recording.title = createRecordingDto.title;
        recording.fileUrl = createRecordingDto.fileUrl;
        recording.type = createRecordingDto.type;

        const userId = createRecordingDto.userId || createRecordingDto.guestId;
        if (userId) {
            recording.user = await this.usersService.findOrCreateBySupabaseId(userId);
        }

        return this.recordingsRepository.save(recording);
    }

    async findAll(userId?: string): Promise<Recording[]> {
        if (userId) {
            return this.recordingsRepository.find({
                where: { user: { supabaseId: userId } },
                order: { createdAt: 'DESC' },
            });
        }
        return this.recordingsRepository.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string): Promise<Recording | null> {
        return this.recordingsRepository.findOne({ where: { id }, relations: ['user'] });
    }

    async claimRecordings(userId: string, recordingIds: string[]): Promise<void> {
        const user = await this.usersService.findOrCreateBySupabaseId(userId);

        if (recordingIds.length === 0) {
            return;
        }

        await this.recordingsRepository
            .createQueryBuilder()
            .update(Recording)
            .set({ user })
            .where('id IN (:...ids)', { ids: recordingIds })
            .execute();
    }

    async update(id: string, updateRecordingDto: UpdateRecordingDto, userId: string): Promise<Recording> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });

        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to update this recording');
        }

        if (updateRecordingDto.title) {
            recording.title = updateRecordingDto.title;
        }

        return this.recordingsRepository.save(recording);
    }

    async delete(id: string, userId: string): Promise<{ success: boolean }> {
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user'],
        });

        if (!recording) {
            throw new NotFoundException(`Recording with ID "${id}" not found`);
        }

        if (recording.user?.supabaseId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this recording');
        }

        await this.recordingsRepository.remove(recording);
        return { success: true };
    }
}
