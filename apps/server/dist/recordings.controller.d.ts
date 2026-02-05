import { StorageService } from './storage/storage.service';
import { RecordingsService } from './recordings.service';
export declare class RecordingsController {
    private readonly storageService;
    private readonly recordingsService;
    constructor(storageService: StorageService, recordingsService: RecordingsService);
    getUploadUrl(body: {
        fileName: string;
        contentType: string;
    }): Promise<{
        url: string;
        fileName: string;
    }>;
    createRecording(body: {
        title: string;
        fileName: string;
        type: 'video' | 'screenshot';
        userId?: string;
    }): Promise<import("./entities/recording.entity").Recording>;
    claimRecordings(req: any, body: {
        recordingIds: string[];
    }): Promise<{
        success: boolean;
    }>;
    getAllRecordings(req: any): Promise<{
        fileUrl: string;
        id: string;
        title: string;
        thumbnailUrl: string;
        type: "video" | "screenshot";
        createdAt: Date;
        updatedAt: Date;
        user: import("./entities/user.entity").User;
    }[]>;
    getRecording(id: string): Promise<{
        fileUrl: string;
        id: string;
        title: string;
        thumbnailUrl: string;
        type: "video" | "screenshot";
        createdAt: Date;
        updatedAt: Date;
        user: import("./entities/user.entity").User;
    } | null>;
    getDownloadUrl(fileName: string): Promise<{
        url: string;
    }>;
}
