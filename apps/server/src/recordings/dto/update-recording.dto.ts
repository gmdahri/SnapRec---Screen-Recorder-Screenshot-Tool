import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateRecordingDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    fileUrl?: string;

    /** Free text under the title. Capped because the viewer renders it
     * untruncated, and an unbounded field there becomes the page. */
    @IsString()
    @IsOptional()
    @MaxLength(2000)
    description?: string;
}
