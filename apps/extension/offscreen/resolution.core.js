/** Resolution picker -> getDisplayMedia constraints.
 *
 * The popup has offered a resolution choice since P1, but nothing consumed it:
 * the constraints were hardcoded to `{ video: { cursor: 'always' } }`, so every
 * recording came out at the native resolution of whatever surface was picked,
 * whatever the control said.
 *
 * The caps are maxima, not targets. `ideal` lets Chrome ignore the request,
 * which is how you get a control that works on one machine and not another;
 * `max` makes the browser scale the captured frames down to fit, so the choice
 * is deterministic. Aspect ratio is preserved by the browser — an ultrawide
 * capped at 1080p comes out 1920x810, not stretched.
 *
 * "Max" means no cap, and it is the default. Unconstrained capture is what this
 * extension has always done, so honouring the old stored '1080p' the moment the
 * picker started working would have silently downgraded every existing 1440p and
 * 4K user's recordings.
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
 * throwing: a stale popup, a half-applied update, or a queued recording from an
 * older version must still be able to record. */
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
