import { IsArray, ArrayMaxSize, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WatchedRangeDto {
    @IsNumber()
    @Min(0)
    startSec: number;

    @IsNumber()
    @Min(0)
    endSec: number;
}

/** A heartbeat of what a viewer has watched since the last one (P7 V4).
 *
 * Ranges rather than a position, because the metric is coverage: a client that
 * reported only "furthest point" could not distinguish watching from skipping.
 *
 * Capped at 200 ranges per call. A well-behaved client sends a handful; the cap
 * stops a malformed or hostile one from making the server merge an unbounded
 * list on every heartbeat. */
export class WatchProgressDto {
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => WatchedRangeDto)
    ranges: WatchedRangeDto[];
}
