import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecordingDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    fileUrl: string;

    @IsString()
    @IsOptional()
    thumbnailUrl?: string;

    @IsEnum(['video', 'screenshot'])
    type: 'video' | 'screenshot';

    /** Whole seconds. Optional: a screenshot has no length, and an uploader
     * that could not measure the file must still be able to save it rather
     * than lose the capture over a missing number.
     *
     * The upper bound is 24 hours — long past anything a screen recorder
     * produces, and it keeps a bad measurement (a webm with no duration in its
     * header reads as Infinity) from being stored as a real length. */
    @IsInt()
    @Min(0)
    @Max(86_400)
    @Type(() => Number)
    @IsOptional()
    durationSec?: number;

    /** Frame size, when the uploader could measure it. Bounded well past 8K so
     * a malformed value cannot be stored as a plausible-looking resolution. */
    @IsInt()
    @Min(1)
    @Max(16_384)
    @Type(() => Number)
    @IsOptional()
    widthPx?: number;

    @IsInt()
    @Min(1)
    @Max(16_384)
    @Type(() => Number)
    @IsOptional()
    heightPx?: number;

    @IsString()
    @IsOptional()
    userId?: string;

    @IsString()
    @IsOptional()
    guestId?: string;
}
