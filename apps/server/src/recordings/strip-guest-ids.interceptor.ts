import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

/** Removes every `guestId`, at any depth, from what an endpoint returns.
 *
 * A guest id is the only proof a guest has that a capture is theirs — it is
 * what claiming an ownerless recording checks, and what a guest's reaction is
 * keyed by — so no response may carry one. Not the recording's, not a
 * comment's or reaction's, not the caller's own: nothing on the web or in the
 * extension reads one back, and every leak so far came from an endpoint
 * returning a loaded entity graph (a comment with its recording attached, a
 * list with its comments) rather than a deliberately shaped body. Applied to
 * the whole controller so a new endpoint cannot reintroduce it by returning
 * an entity. */
export function stripGuestIds<T>(value: T, seen = new WeakMap<object, unknown>()): T {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (seen.has(value)) return seen.get(value) as T;
    if (Array.isArray(value)) {
        const out: unknown[] = [];
        seen.set(value, out);
        for (const item of value) out.push(stripGuestIds(item, seen));
        return out as T;
    }
    const out: Record<string, unknown> = {};
    seen.set(value, out);
    for (const [key, item] of Object.entries(value)) {
        if (key === 'guestId') continue;
        out[key] = stripGuestIds(item, seen);
    }
    return out as T;
}

@Injectable()
export class StripGuestIdsInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler) {
        return next.handle().pipe(map((body) => stripGuestIds(body)));
    }
}
