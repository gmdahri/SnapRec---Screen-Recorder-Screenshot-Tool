import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { Reaction } from './entities/reaction.entity';
import { Comment } from './entities/comment.entity';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';

@Injectable()
export class RecordingsService {
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectRepository(Recording)
        private readonly recordingsRepository: Repository<Recording>,
        @InjectRepository(Reaction)
        private readonly reactionsRepository: Repository<Reaction>,
        @InjectRepository(Comment)
        private readonly commentsRepository: Repository<Comment>,
        private readonly usersService: UsersService,
    ) { }

    async create(createRecordingDto: CreateRecordingDto): Promise<Recording> {
        const recording = new Recording();
        if (createRecordingDto.id) {
            recording.id = createRecordingDto.id;
        }
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
        const recording = await this.recordingsRepository.findOne({
            where: { id },
            relations: ['user', 'reactions', 'reactions.user', 'comments', 'comments.user']
        });

        if (recording) {
            recording.views += 1;
            await this.recordingsRepository.save(recording);
        }

        return recording;
    }

    async addReaction(recordingId: string, type: string, userId?: string, guestId?: string): Promise<Reaction> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        let reaction = await this.reactionsRepository.findOne({
            where: userId ? { recording: { id: recordingId }, user: { supabaseId: userId } } : { recording: { id: recordingId }, guestId }
        });

        if (reaction) {
            if (reaction.type === type) {
                await this.reactionsRepository.remove(reaction);
                return reaction; // Return the removed reaction or a flag
            }
            reaction.type = type;
        } else {
            reaction = new Reaction();
            reaction.recording = recording;
            reaction.type = type;
            if (userId) {
                reaction.user = await this.usersService.findOrCreateBySupabaseId(userId);
            } else if (guestId) {
                reaction.guestId = guestId;
            }
        }

        return this.reactionsRepository.save(reaction);
    }

    async addComment(recordingId: string, content: string, userId?: string, guestId?: string): Promise<Comment> {
        const recording = await this.recordingsRepository.findOne({ where: { id: recordingId } });
        if (!recording) throw new NotFoundException('Recording not found');

        const comment = new Comment();
        comment.recording = recording;
        comment.content = content;

        if (userId) {
            comment.user = await this.usersService.findOrCreateBySupabaseId(userId);
        } else if (guestId) {
            comment.guestId = guestId;
        }

        return this.commentsRepository.save(comment);
    }

    async claimRecordings(userId: string, recordingIds: string[]): Promise<void> {
        const user = await this.usersService.findOrCreateBySupabaseId(userId);

        if (recordingIds.length === 0) {
            return;
        }

        const recordings = await this.recordingsRepository.find({
            where: { id: In(recordingIds) }
        });

        for (const recording of recordings) {
            recording.user = user;
        }

        await this.recordingsRepository.save(recordings);
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

        if (updateRecordingDto.fileUrl) {
            recording.fileUrl = updateRecordingDto.fileUrl;
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
