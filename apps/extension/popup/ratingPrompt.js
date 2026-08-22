/** The rating prompt's gate.
 *
 * Three conditions, all of which must hold:
 *
 *   1. At least RATING_THRESHOLD completed recordings. Asking someone who has
 *      not finished a recording yet is asking them to rate something they have
 *      not used.
 *   2. Never shown before. Both buttons mark it shown, so the banner appears at
 *      most once in the lifetime of an install.
 *   3. Analytics not opted out. Someone who turned telemetry off has already
 *      said they do not want to be measured or marketed to; a rating ask is the
 *      same category of request.
 *
 * The count is written by background.js at the end of a recording. This module
 * only reads it — the popup is not always open when a recording finishes, so it
 * cannot be the thing that counts.
 *
 * Every read fails closed: a storage error means no prompt, never a broken
 * popup. Not showing a rating ask costs nothing; breaking the completion view
 * costs a recording.
 */

const COUNT_KEY = 'completedRecordingsCount';
const SHOWN_KEY = 'ratingPromptShown';
const OPT_OUT_KEY = 'analyticsOptOut';

/** Completed recordings before the prompt is eligible. */
export const RATING_THRESHOLD = 2;

/** Whether the banner should appear in the completion view.
 *
 * The threshold is a floor rather than an equality: if the prompt was never
 * shown at exactly the threshold — popup closed, storage write lost, opted out
 * at the time — the user still gets their one chance later, instead of the
 * prompt being silently unreachable forever. */
export async function shouldShowRatingPrompt() {
    try {
        const stored = await chrome.storage.local.get([COUNT_KEY, SHOWN_KEY, OPT_OUT_KEY]);
        if (stored?.[SHOWN_KEY] === true) return false;
        if (stored?.[OPT_OUT_KEY] === true) return false;
        return (stored?.[COUNT_KEY] ?? 0) >= RATING_THRESHOLD;
    } catch {
        return false;
    }
}

/** Retire the prompt for good. Called by BOTH buttons — "Not now" is a decision,
 * not a postponement, and re-asking is exactly the nagging this avoids. */
export async function markRatingPromptShown() {
    try {
        await chrome.storage.local.set({ [SHOWN_KEY]: true });
    } catch {
        // Worst case the prompt reappears once on a later completion. Still
        // better than throwing inside a click handler.
    }
}

/** The store's review page for whichever build is running.
 *
 * Built from chrome.runtime.id rather than a hardcoded id or slug: the same code
 * then works for the published extension and for an unpacked dev load, and it
 * cannot drift if the listing slug ever changes. */
export function reviewUrl() {
    return `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
}
