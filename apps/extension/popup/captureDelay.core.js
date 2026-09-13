/** The screenshot timer.
 *
 * An open dropdown, a hover state or a tooltip cannot be screenshotted without
 * one: clicking the extension closes the menu, and the capture records the page
 * without the thing you wanted. The delay is what makes those possible, so it
 * is a first-class control rather than a setting buried in options.
 *
 * Pure, and imported by the popup as an ES module — popup/ is module scripts,
 * unlike background/, so there is no classic twin to keep in step here.
 */

export const VALID_DELAYS = [0, 3, 5];
export const DEFAULT_DELAY = 0;

/** The next value in the cycle, wrapping.
 *
 * An unrecognised value — written by an older or newer build — behaves as if
 * it were the default rather than dead-ending the chip on something the
 * capture path would not honour. */
export function nextDelay(current) {
  const i = VALID_DELAYS.indexOf(current);
  if (i === -1) return VALID_DELAYS[1];
  return VALID_DELAYS[(i + 1) % VALID_DELAYS.length];
}

/** What the chip reads. Describes the wait, not the setting: "3s delay" says
 * what will happen, where "Delay: 3" says what a field contains. */
export function delayLabel(value) {
  return VALID_DELAYS.includes(value) && value > 0 ? `${value}s delay` : 'No delay';
}
