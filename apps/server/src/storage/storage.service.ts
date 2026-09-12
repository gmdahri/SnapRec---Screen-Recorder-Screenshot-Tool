import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
    CreateMultipartUploadCommand, UploadPartCommand,
    CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const accountId = (this.configService.get<string>('R2_ACCOUNT_ID') || '').trim();
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';

        const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        this.logger.log(`Initializing R2 Storage with endpoint: ${endpoint}`);

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            forcePathStyle: true,
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

    /** Opens a multipart upload and returns R2's id for it.
     *
     * From here until complete or abort, every part that lands is billed
     * storage that does not appear in a bucket listing. Nothing else in this
     * service has that property, which is why abort below is not optional. */
    async createMultipartUpload(fileName: string, contentType: string): Promise<string> {
        const result = await this.s3Client.send(new CreateMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            ContentType: contentType,
        }));
        if (!result.UploadId) {
            throw new Error(`R2 returned no UploadId for ${fileName}`);
        }
        this.logger.log(`Multipart upload opened for ${fileName}: ${result.UploadId}`);
        return result.UploadId;
    }

    /** A presigned URL for one part. The extension PUTs to it directly — part
     * bytes never reach this server. */
    async getUploadPartUrl(fileName: string, uploadId: string, partNumber: number): Promise<string> {
        const command = new UploadPartCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
            PartNumber: partNumber,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    /** Assembles the parts into the finished object.
     *
     * R2 validates the whole list here, at the end — so an empty list is
     * rejected up front rather than after a round trip. */
    async completeMultipartUpload(
        fileName: string,
        uploadId: string,
        parts: Array<{ PartNumber: number; ETag: string }>,
    ): Promise<void> {
        if (!parts.length) {
            throw new Error(`Refusing to complete ${fileName} with no parts`);
        }
        await this.s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
        }));
        this.logger.log(`Multipart upload completed for ${fileName} (${parts.length} parts)`);
    }

    /** Discards the parts. Until this runs — or the bucket's 1-day lifecycle
     * rule runs for us — they keep billing. */
    async abortMultipartUpload(fileName: string, uploadId: string): Promise<void> {
        await this.s3Client.send(new AbortMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: fileName,
            UploadId: uploadId,
        }));
        this.logger.log(`Multipart upload aborted for ${fileName}`);
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

    async getDownloadStream(fileName: string) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: fileName,
        });

        const response = await this.s3Client.send(command);
        return {
            stream: response.Body as any,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
        };
    }

    async checkFileExists(fileName: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
            });
            await this.s3Client.send(command);
            return true;
        } catch (err) {
            return false;
        }
    }

    /** Object size in bytes (HeadObject); null if missing or error. */
    async getContentLength(fileName: string): Promise<number | null> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
            });
            const out = await this.s3Client.send(command);
            const n = out.ContentLength;
            return typeof n === 'number' && n >= 0 ? n : null;
        } catch {
            return null;
        }
    }

    /** Delete a file from R2 by key (fileName). Used for cleanup and wipe scripts. */
    async deleteObject(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        await this.s3Client.send(command);
    }
}
