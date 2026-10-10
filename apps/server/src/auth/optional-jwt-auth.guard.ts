import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Lets guests through; does not let an expired session pass as one.
 *
 * A request with no Authorization header is a guest, and the endpoint
 * decides what a guest may do. A request that carries a token is a signed-in
 * client, and if that token fails to verify — expired, revoked, malformed —
 * the answer is 401. Treating it as a guest used to file a signed-in user's
 * recording, comment or reaction under nobody, without telling them; a 401 is
 * what lets the client say "your session expired" and keep their work. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
        if (user && !err) return user;
        const presented = context.switchToHttp().getRequest()?.headers?.authorization;
        if (presented) {
            throw new UnauthorizedException('Your session has expired. Sign in again.');
        }
        return null;
    }
}
