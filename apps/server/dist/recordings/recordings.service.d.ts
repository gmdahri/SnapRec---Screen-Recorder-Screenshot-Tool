import { Repository } from 'typeorm';
import { Recording } from './entities/recording.entity';
import { UsersService } from '../users/users.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
export declare class RecordingsService {
    private readonly recordingsRepository;
    private readonly usersService;
    private readonly logger;
    constructor(recordingsRepository: Repository<Recording>, usersService: UsersService);
    create(createRecordingDto: CreateRecordingDto): Promise<Recording>;
    findAll(userId?: string): Promise<Recording[]>;
    findOne(id: string): Promise<Recording | null>;
    claimRecordings(userId: string, recordingIds: string[]): Promise<void>;
    update(id: string, updateRecordingDto: UpdateRecordingDto, userId: string): Promise<Recording>;
    delete(id: string, userId: string): Promise<{
        success: boolean;
    }>;
}
