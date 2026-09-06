import { Module } from '@nestjs/common';
import { UploadPolicyService } from './upload-policy.service';
import { StorageService } from './storage.service';

@Module({
    providers: [StorageService, UploadPolicyService],
    exports: [StorageService, UploadPolicyService],
})
export class StorageModule { }
