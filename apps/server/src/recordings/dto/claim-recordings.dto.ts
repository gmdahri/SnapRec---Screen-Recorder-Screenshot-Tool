import { IsArray, IsOptional, IsString, IsUUID, ArrayMaxSize } from 'class-validator';

export class ClaimRecordingsDto {
    @ArrayMaxSize(200)
    @IsArray()
    @IsUUID('4', { each: true })
    recordingIds: string[];

    /** Legacy client field accepted for compatibility; authorization uses the
     * private X-Snaprec-Guest credential, never this public identifier. */
    @IsOptional()
    @IsString()
    guestId?: string;
}
