/** The rating prompt's gate.
 *
 * Asked at most three times in the lifetime of an install, at the 3rd, 8th and
 * 15th completed recording. Every condition below must hold:
 *
 *   1. Enough completed recordings for the next showing's threshold. Asking
 *      someone who has not finished a recording yet is asking them to rate
 *      something they have not used.
 *   2. Fewer than RATING_THRESHOLDS.length showings so far. After the third the
 *      prompt is retired whatever the answer was — someone who has declined
 *      three times has answered.
 *   3. The user has not already rated. "Rate" is final; "Maybe later" is not.
 *   4. Analytics not opted out. Someone who turned telemetry off has already
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
const SHOW_COUNT_KEY = 'ratingPromptShowCount';
const LAST_SHOWN_AT_KEY = 'ratingPromptLastShownAt';
const RATED_KEY = 'ratingPromptRated';
const OPT_OUT_KEY = 'analyticsOptOut';

/** The legacy one-shot flag, set by BOTH buttons of the old banner.
 *
 * It recorded "was asked once" and nothing more — the old markRatingPromptShown
 * could not tell a rating from a dismissal. So an install carrying it is
 * migrated to exactly that: one showing consumed, two left. The alternative,
 * treating it as permanent suppression, would exclude every existing user from
 * a change whose entire point is to reach them.
 *
 * The cost is that someone who did rate via the old banner can be asked again.
 * That is not recoverable from the old data, and the store simply shows them
 * the review they already left. */
const LEGACY_SHOWN_KEY = 'ratingPromptShown';

/** Completed recordings at which each showing becomes due. */
export const RATING_THRESHOLDS = [3, 8, 15];

/** Recordings that must pass between two showings.
 *
 * Derived from the thresholds rather than written twice: 3, then 5, then 7.
 * Without this an install that is already past every threshold — which is most
 * of them, since this prompt shipped once before — would get all three asks on
 * three consecutive completions. The thresholds describe a cadence, not just
 * three numbers, and this is what preserves the cadence for a user who arrives
 * at it late. */
function gapBefore(showingIndex) {
    return RATING_THRESHOLDS[showingIndex] - (RATING_THRESHOLDS[showingIndex - 1] ?? 0);
}

/** Whether the modal is due, and which of the three showings it would be.
 *
 * Returns `{ show: false, showing: 0 }` rather than throwing, for every reason
 * it might decline — including a storage failure.
 *
 * The threshold is a floor rather than an equality: if a showing was missed at
 * exactly its threshold — popup closed, storage write lost, opted out at the
 * time — the user still reaches it later instead of the prompt being silently
 * unreachable forever.
 *
 * @returns {Promise<{ show: boolean, showing: number }>}
 */
export async function ratingPromptState() {
    const none = { show: false, showing: 0 };
    try {
        const stored = await chrome.storage.local.get([
            COUNT_KEY, SHOW_COUNT_KEY, LAST_SHOWN_AT_KEY, RATED_KEY, OPT_OUT_KEY, LEGACY_SHOWN_KEY,
        ]);

        if (stored?.[RATED_KEY] === true) return none;
        if (stored?.[OPT_OUT_KEY] === true) return none;

        const shown = showingsSoFar(stored);
        if (shown >= RATING_THRESHOLDS.length) return none;

        const completed = stored?.[COUNT_KEY] ?? 0;
        const lastShownAt = stored?.[LAST_SHOWN_AT_KEY] ?? 0;

        const due = completed >= RATING_THRESHOLDS[shown]
            && completed >= lastShownAt + gapBefore(shown);

        return due ? { show: true, showing: shown + 1 } : none;
    } catch {
        return none;
    }
}

/** Showings already consumed, folding in the legacy flag. */
function showingsSoFar(stored) {
    const explicit = stored?.[SHOW_COUNT_KEY];
    if (typeof explicit === 'number') return explicit;
    return stored?.[LEGACY_SHOWN_KEY] === true ? 1 : 0;
}

/** Spend one showing.
 *
 * Called when the modal actually appears, not when it is answered: an ask the
 * user closed the popup on has still been made, and re-asking on the next
 * completion is the nagging the thresholds exist to prevent.
 *
 * Writes the recording count alongside, so the next showing can hold its
 * spacing from where this one landed rather than from its own threshold.
 */
export async function recordRatingPromptShowing() {
    try {
        const stored = await chrome.storage.local.get([
            COUNT_KEY, SHOW_COUNT_KEY, LEGACY_SHOWN_KEY,
        ]);
        await chrome.storage.local.set({
            [SHOW_COUNT_KEY]: showingsSoFar(stored) + 1,
            [LAST_SHOWN_AT_KEY]: stored?.[COUNT_KEY] ?? 0,
        });
    } catch {
        // Worst case the same showing is offered again on a later completion.
        // Still better than throwing inside a render pass.
    }
}

/** Retire the prompt for good. "Rate" only — "Maybe later" leaves the remaining
 * showings intact, which is the whole difference from the old one-shot banner. */
export async function markRatingPromptRated() {
    try {
        await chrome.storage.local.set({ [RATED_KEY]: true });
    } catch {
        // Worst case the prompt reappears once at a later threshold. Still
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
