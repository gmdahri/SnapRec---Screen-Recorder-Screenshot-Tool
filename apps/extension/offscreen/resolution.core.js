/** Resolution picker -> getDisplayMedia constraints.
 *
 * The popup has offered a resolution choice since P1, but nothing consumed it:
 * the constraints were hardcoded to `{ video: { cursor: 'always' } }`, so every
 * recording came out at the native resolution of whatever surface the user
 * picked, whatever the control said.
 *
 * The caps are maxima, not targets. `ideal` lets Chrome ignore the request,
 * which is how you get a control that works on some machines and not others;
 * `max` makes the browser scale the captured frames down to fit, so the choice
 * is deterministic. Aspect ratio is preserved by the browser — an ultrawide
 * capped at 1080p comes out 1920x810, not stretched to 1920x1080.
 *
 * "Max" means no cap, and it is the default. Unconstrained capture is what this
 * extension has always done, so any numeric default would silently downgrade
 * existing 1440p and 4K users' recordings the moment this shipped.
 *
 * This is the ES-module copy the tests import. offscreen/resolution.js is the
 * classic-script twin the offscreen document loads — tests/resolution.test.js
 * fails if the two drift.
 */

const RESOLUTION_CAPS = Object.freeze({
  '720p': Object.freeze({ width: 1280, height: 720 }),
  '1080p': Object.freeze({ width: 1920, height: 1080 }),
  '1440p': Object.freeze({ width: 2560, height: 1440 }),
  '4K': Object.freeze({ width: 3840, height: 2160 }),
});

/** Build the video half of a getDisplayMedia constraint object.
 *
 * Unknown, missing and non-string values fall through to no cap rather than
 * throwing: a stale popup, a half-applied update, or an old queued recording
 * must still be able to record. */
function displayConstraints(resolution) {
  const video = { cursor: 'always' };
  const cap = typeof resolution === 'string' ? RESOLUTION_CAPS[resolution] : undefined;

  if (cap) {
    video.width = { max: cap.width };
    video.height = { max: cap.height };
  }

  return { video };
}

export { RESOLUTION_CAPS, displayConstraints };
