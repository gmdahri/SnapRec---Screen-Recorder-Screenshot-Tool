import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AddReactionDto {
    @IsEnum(['like', 'love', 'celebrate', 'insightful', 'curious'])
    type: string;

    @IsOptional()
    @IsString()
    guestId?: string;
}
