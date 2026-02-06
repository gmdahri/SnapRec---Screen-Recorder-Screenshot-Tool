import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateRecordingDto {
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

    @IsString()
    @IsOptional()
    userId?: string;

    @IsString()
    @IsOptional()
    guestId?: string;
}
