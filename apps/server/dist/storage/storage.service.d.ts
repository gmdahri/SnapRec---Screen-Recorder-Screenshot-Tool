import { OnModuleInit } from '@nestjs/common';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
export declare class StorageService implements OnModuleInit {
    private configService;
    private readonly logger;
    private s3Client;
    private bucketName;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    getUploadPresignedUrl(fileName: string, contentType: string): Promise<string>;
    getDownloadUrl(fileName: string): Promise<string>;
    checkFileExists(fileName: string): Promise<boolean>;
    getDownloadStream(fileName: string): Promise<{
        stream: Readable;
        contentType: string | undefined;
        contentLength: number | undefined;
    }>;
}
