import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/** Replaces the media behind an existing recording (P7 E6).
 *
 * Only the file and its length: publishing changes what people see, not who
 * owns it, what it is called, or who has commented. Widening this DTO would
 * make an edit-and-publish able to quietly rewrite ownership. */
export class PublishRecordingDto {
    /** R2 key of the already-uploaded replacement. */
    @IsString()
    @IsNotEmpty()
    fileUrl: string;

    @IsInt()
    @Min(0)
    @Max(86_400)
    @Type(() => Number)
    @IsOptional()
    durationSec?: number;
}
