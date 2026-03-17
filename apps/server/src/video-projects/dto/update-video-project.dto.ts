import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateVideoProjectDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsObject()
  @IsOptional()
  timelineJson?: Record<string, unknown>;

  /** New storage key after export re-upload (replaces recording file) */
  @IsString()
  @IsOptional()
  newFileUrl?: string;
}
