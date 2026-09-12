import { Type } from 'class-transformer';
import {
    ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class BeginUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;
}

export class PartUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;

    /** One-based, and capped at R2's maximum of 10,000 parts per upload. */
    @IsInt()
    @Min(1)
    @Max(10000)
    partNumber: number;
}

export class UploadedPartDto {
    @IsInt()
    @Min(1)
    @Max(10000)
    PartNumber: number;

    @IsString()
    @IsNotEmpty()
    ETag: string;
}

export class CompleteUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;

    /** R2 validates this list only at completion — after the whole recording
     * has been uploaded — so an obviously bad list is refused here instead. */
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UploadedPartDto)
    parts: UploadedPartDto[];
}

export class AbortUploadDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    uploadId: string;
}
