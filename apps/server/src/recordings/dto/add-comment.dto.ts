import { IsString, IsOptional, MinLength } from 'class-validator';

export class AddCommentDto {
    @IsString()
    @MinLength(1)
    content: string;

    @IsOptional()
    @IsString()
    guestId?: string;
}
