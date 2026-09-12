/** Turns an expiry timestamp into the sentence a guest needs to read.
 *
 * Words rather than a bare timer: the consequence is permanent deletion and
 * the remedy is signing in, and a lone countdown communicates neither. */

export function describeExpiry(
    expiresAt: string | null | undefined,
    now: Date = new Date(),
): { expired: boolean; text: string } | null {
    if (!expiresAt) return null;

    const deadline = new Date(expiresAt).getTime();
    if (Number.isNaN(deadline)) return null;

    const remainingMs = deadline - now.getTime();
    if (remainingMs <= 0) return { expired: true, text: 'This recording has expired' };

    const minutes = Math.floor(remainingMs / 60000);
    const when = minutes < 1 ? 'less than a minute'
        : minutes === 1 ? '1 minute'
            : `${minutes} minutes`;

    return { expired: false, text: `This recording deletes in ${when} unless you sign in` };
}
