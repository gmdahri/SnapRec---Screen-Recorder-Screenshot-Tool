/** Capture options that outlive the popup.
 *
 * The popup's state machine is rebuilt from initialState() every time the popup
 * opens, which is correct for view state and wrong for a preference: picking
 * 720p and reopening the popup put it straight back to the default. Anything the
 * user chose deliberately has to live in chrome.storage.local.
 *
 * Only resolution is stored here. The analytics switch has its own flag, owned by
 * the background because it is read there before every event; countdown, autoZoom
 * and cursor are not persisted because nothing consumes them yet — persisting a
 * setting that does nothing would just make the dead control harder to spot.
 *
 * Every read and write is failure-tolerant. A preference is not worth breaking
 * the popup over: if storage is unavailable the picker simply shows the default.
 */

const RESOLUTION_KEY = 'captureResolution';

/** Labels the picker offers. Must stay in step with RESOLUTIONS in render.js and
 * RESOLUTION_CAPS in offscreen/resolution.core.js — tests/resolution.test.js
 * checks all three agree. 'Max' means no cap. */
const VALID = ['Max', '4K', '1440p', '1080p', '720p'];

export const DEFAULT_RESOLUTION = 'Max';

/** The stored resolution, or the default.
 *
 * Validates against the known set so a value written by an older or newer build
 * cannot leave the picker showing something it cannot honour — that would be the
 * same class of bug this whole change is fixing. */
export async function loadResolution() {
    try {
        const stored = await chrome.storage.local.get(RESOLUTION_KEY);
        const value = stored?.[RESOLUTION_KEY];
        return VALID.includes(value) ? value : DEFAULT_RESOLUTION;
    } catch {
        return DEFAULT_RESOLUTION;
    }
}

/** Remember a picked resolution. Resolves either way; never throws. */
export async function saveResolution(value) {
    if (!VALID.includes(value)) return;
    try {
        await chrome.storage.local.set({ [RESOLUTION_KEY]: value });
    } catch {
        // Storage unavailable — the choice still applies to this session, it
        // just will not survive the popup closing.
    }
}
