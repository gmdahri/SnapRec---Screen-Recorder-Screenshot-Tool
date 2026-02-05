import { IsString, IsNotEmpty } from 'class-validator';

export class UploadUrlDto {
    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsString()
    @IsNotEmpty()
    contentType: string;
}
