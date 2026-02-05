import { Repository } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { User } from './entities/user.entity';
export declare class RecordingsService {
    private readonly recordingsRepository;
    private readonly usersRepository;
    constructor(recordingsRepository: Repository<Recording>, usersRepository: Repository<User>);
    create(data: {
        title: string;
        fileUrl: string;
        type: 'video' | 'screenshot';
        userId?: string;
    }): Promise<Recording>;
    findAll(userId?: string): Promise<Recording[]>;
    findOne(id: string): Promise<Recording | null>;
    claimRecordings(userId: string, recordingIds: string[]): Promise<void>;
}
