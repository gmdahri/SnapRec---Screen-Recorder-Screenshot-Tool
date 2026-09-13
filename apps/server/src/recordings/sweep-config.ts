/** Whether the expiry sweep is actually reachable.
 *
 * POST /recordings/sweep-expired answers 404 when SWEEP_SECRET is unset, so it
 * does not advertise itself to anyone probing. The cost of that choice is that
 * a scheduler pointed at a service missing the variable fails silently forever
 * — guest recordings never expire, storage grows, and nothing says why.
 *
 * Checked at boot so the answer is in the logs before anyone needs to ask.
 */
export function sweepConfigWarning(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string | null {
    const secret = (env.SWEEP_SECRET ?? '').trim();
    if (secret) return null;

    return 'SWEEP_SECRET is not set: POST /recordings/sweep-expired will answer 404, '
        + 'so unclaimed guest recordings will never expire and their storage will grow '
        + 'unbounded. Set it here and on the Cloud Scheduler job that calls it.';
}
