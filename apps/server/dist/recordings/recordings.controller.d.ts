import { StorageService } from '../storage/storage.service';
import { RecordingsService } from './recordings.service';
import { UploadUrlDto, CreateRecordingDto, UpdateRecordingDto, ClaimRecordingsDto } from './dto';
export declare class RecordingsController {
    private readonly storageService;
    private readonly recordingsService;
    private readonly logger;
    constructor(storageService: StorageService, recordingsService: RecordingsService);
    getUploadUrl(uploadUrlDto: UploadUrlDto): Promise<{
        uploadUrl: string;
        fileUrl: string;
    }>;
    createRecording(createRecordingDto: CreateRecordingDto): Promise<import(".").Recording>;
    claimRecordings(req: any, claimRecordingsDto: ClaimRecordingsDto): Promise<{
        success: boolean;
    }>;
    getAllRecordings(req: any): Promise<({
        fileUrl: string;
        id: string;
        title: string;
        thumbnailUrl: string;
        type: "video" | "screenshot";
        createdAt: Date;
        updatedAt: Date;
        user: import("../users").User;
    } | {
        fileUrl: null;
        id: string;
        title: string;
        thumbnailUrl: string;
        type: "video" | "screenshot";
        createdAt: Date;
        updatedAt: Date;
        user: import("../users").User;
    })[]>;
    getRecording(id: string): Promise<{
        fileUrl: string;
        id: string;
        title: string;
        thumbnailUrl: string;
        type: "video" | "screenshot";
        createdAt: Date;
        updatedAt: Date;
        user: import("../users").User;
    }>;
    getDownloadUrl(fileName: string): Promise<{
        url: string;
    }>;
    updateRecording(id: string, updateRecordingDto: UpdateRecordingDto, req: any): Promise<import(".").Recording>;
    deleteRecording(id: string, req: any): Promise<{
        success: boolean;
    }>;
}
