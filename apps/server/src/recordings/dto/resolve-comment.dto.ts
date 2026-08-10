import { IsBoolean, IsOptional } from 'class-validator';

/** Defaults to resolving. Reopening is the deliberate act, so it must be
 * spelled out — and the global ValidationPipe rejects any field not declared
 * here, so this has to exist even for a one-field body. */
export class ResolveCommentDto {
    @IsBoolean()
    @IsOptional()
    resolved?: boolean;
}
