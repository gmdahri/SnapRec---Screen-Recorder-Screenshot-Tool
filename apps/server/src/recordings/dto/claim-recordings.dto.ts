import { IsArray, IsUUID } from 'class-validator';

export class ClaimRecordingsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    recordingIds: string[];
}
