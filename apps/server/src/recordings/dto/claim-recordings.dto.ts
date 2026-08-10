import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class ClaimRecordingsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    recordingIds: string[];

    /** The caller's local guest id. When present the claim is scoped to
     * recordings that guest actually made; without it only ownerless rows
     * predating the guestId column can be claimed. */
    @IsOptional()
    @IsString()
    guestId?: string;
}
