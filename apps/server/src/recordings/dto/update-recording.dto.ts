import { IsString, IsOptional } from 'class-validator';

export class UpdateRecordingDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    fileUrl?: string;
}
