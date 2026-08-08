import { IsIn, IsOptional } from 'class-validator';

/** The global ValidationPipe runs with whitelist + forbidNonWhitelisted, so a
 * query field not declared here is a 400. Add the property; never bypass. */
export class SharedQueryDto {
    @IsOptional()
    @IsIn(['by-me', 'with-me'])
    direction?: 'by-me' | 'with-me';
}
