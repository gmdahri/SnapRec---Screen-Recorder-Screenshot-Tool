import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    }

    onModuleInit() {
        if (this.bucketName) {
            this.logger.log(`Cloudflare R2 Storage initialized. Bucket: ${this.bucketName}`);
        } else {
            this.logger.warn('Cloudflare R2 Bucket name not configured!');
        }
    }

    async getUploadPresignedUrl(fileName: string, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileName,
            ContentType: contentType,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    async getDownloadUrl(fileName: string) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: fileName,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    async checkFileExists(fileName: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
            });
            await this.s3Client.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    async getDownloadStream(fileName: string) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: fileName,
        });

        const response = await this.s3Client.send(command);
        return {
            stream: response.Body as Readable,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
        };
    }
}
