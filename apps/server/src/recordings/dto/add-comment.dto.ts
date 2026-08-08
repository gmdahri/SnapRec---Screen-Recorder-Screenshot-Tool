import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class AddCommentDto {
    @IsString()
    @MinLength(1)
    content: string;

    @IsOptional()
    @IsString()
    guestId?: string;

    /** Video comments only — the moment being talked about. */
    @IsOptional()
    @IsInt()
    @Min(0)
    timecodeMs?: number;

    /** Image comments only — normalised horizontal position, 0–1.
     *
     * Stored normalised rather than in pixels: the same screenshot renders at
     * different widths on desktop, tablet and mobile, and pins must land on
     * the same feature at every size. */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    anchorX?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    anchorY?: number;
}
