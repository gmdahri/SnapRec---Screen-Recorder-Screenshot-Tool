/** A signed-in request the server would not accept as signed in.
 *
 * The API answers 401 when a request carries a token that no longer verifies,
 * and 403 "userId does not match" when a request names a user it carries no
 * valid token for — which is what a lapsed session looks like from here. Both
 * mean the same thing to the person using the page: sign in again. Neither
 * may be retried as a guest, which is what the server used to do quietly. */
export class SessionExpiredError extends Error {
    constructor(message = 'Your session expired. Sign in again.') {
        super(message);
        this.name = 'SessionExpiredError';
    }
}

export function isSessionExpired(error: unknown): error is SessionExpiredError {
    return error instanceof SessionExpiredError;
}

/** Whether an API error response means the session is gone. */
export function sessionExpiredResponse(status: number, body: string): boolean {
    if (status === 401) return true;
    return status === 403 && /userId does not match/i.test(body);
}
