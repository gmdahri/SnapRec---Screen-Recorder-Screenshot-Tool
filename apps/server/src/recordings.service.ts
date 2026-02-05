import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { User } from './entities/user.entity';

@Injectable()
export class RecordingsService {
    constructor(
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    async create(data: {
        title: string;
        fileUrl: string;
        type: 'video' | 'screenshot';
        userId?: string;
    }) {
        const recording = new Recording();
        recording.title = data.title;
        recording.fileUrl = data.fileUrl;
        recording.type = data.type;

        if (data.userId) {
            const user = await this.usersRepository.findOne({ where: { id: data.userId } });
            if (user) {
                recording.user = user;
            }
        }

        return this.recordingsRepository.save(recording);
    }

    async findAll(userId?: string) {
        if (userId) {
            return this.recordingsRepository.find({
                where: { user: { id: userId } },
                order: { createdAt: 'DESC' },
            });
        }
        return this.recordingsRepository.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string) {
        return this.recordingsRepository.findOne({ where: { id }, relations: ['user'] });
    }

    async claimRecordings(userId: string, recordingIds: string[]) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        await this.recordingsRepository
            .createQueryBuilder()
            .update(Recording)
            .set({ user })
            .where('id IN (:...ids)', { ids: recordingIds })
            .andWhere('userId IS NULL')
            .execute();
    }
}
