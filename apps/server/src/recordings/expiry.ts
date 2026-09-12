/** How long an unclaimed guest recording survives.
 *
 * One hour, measured from upload completion rather than from the start of
 * recording — a fifty-minute recording would otherwise get ten minutes. A
 * guest cannot share or download without signing in, and signing in claims the
 * recording and clears this, so the window only ever affects a capture that
 * nobody but its creator can reach.
 */
export const GUEST_TTL_MS = 60 * 60 * 1000;

export function expiresAtForUpload(hasUser: boolean, now: Date = new Date()): Date | null {
    return hasUser ? null : new Date(now.getTime() + GUEST_TTL_MS);
}
