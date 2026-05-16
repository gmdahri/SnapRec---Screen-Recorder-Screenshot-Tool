import { IsArray, ValidateNested, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SegmentDto {
    @IsNumber()
    start: number;

    @IsNumber()
    end: number;

    @IsString()
    text: string;

    @IsOptional()
    @IsNumber()
    speaker?: number;
}

export class UpdateTranscriptSegmentsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SegmentDto)
    segments: SegmentDto[];
}
