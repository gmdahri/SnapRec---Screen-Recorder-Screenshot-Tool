import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateVideoProjectDto {
  @IsUUID()
  recordingId: string;

  @IsString()
  @IsOptional()
  title?: string;
}
