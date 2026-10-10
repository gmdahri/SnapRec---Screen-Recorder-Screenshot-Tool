import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Identifies the viewer of a public page if it can, and never refuses.
 *
 * For reads only. A valid token says who is looking, so the response can
 * answer "is this mine" for them; anything else — no token, an expired one,
 * garbage — is an anonymous viewer, and the page still loads. Write
 * endpoints use OptionalJwtAuthGuard instead, which answers 401 for a token
 * that does not verify rather than quietly acting as nobody. */
@Injectable()
export class LenientJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any) {
        return !err && user ? user : null;
    }
}
