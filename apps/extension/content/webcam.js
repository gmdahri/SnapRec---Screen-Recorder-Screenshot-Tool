/** In-page webcam overlay (P2).
 *
 * This is the CLASSIC-SCRIPT copy the content script loads. webcam.core.js
 * holds the identical bodies for the tests — __tests__/webcam.test.js fails if
 * the two drift. */

/* `var`, not `const`: this file is injected fresh on every
 * ContentScriptManager.inject, and a classic script re-running would throw
 * "Identifier 'SHAPES' has already been declared" on the second injection —
 * which killed the whole content script for that tab. `var` and function
 * declarations both tolerate redeclaration. Content scripts run in an
 * isolated world, so this shares nothing with the page.
 * Kept identical in webcam.core.js so the drift test still compares equal. */
var SHAPES = {
  rect: { borderRadius: 6 },
  circle: { borderRadius: '50%' },
};

/** Two shapes, no more. A shape picker with six options is a decision nobody
 * wants to make while setting up a recording. */
function shapeFor(name) {
  const shape = SHAPES[name];
  if (!shape) throw new Error(`unknown webcam shape: ${name}`);
  return shape;
}

/** The word carries the state, so a muted mic is unambiguous in a screenshot
 * and under reduced motion — not merely the absence of a ring. */
function statusLabel(state) {
  if (state.cameraLost) return 'Camera in use by another app';
  if (state.micMuted) return 'Microphone muted';
  return null;
}

function overlayState(state) {
  return {
    // Handles appear only once the overlay is clicked. Unselected it is a
    // plain shape, so it does not invite dragging before the user commits.
    showHandles: Boolean(state.selected),

    // Level without animation: the ring shows mic level, and muting removes
    // the ring and adds the word rather than freezing a ring at zero.
    showLevelRing: !state.micMuted && !state.cameraLost,

    // Errors don't stop the take. Losing the camera collapses the overlay to
    // a labelled pill; the recording continues without it.
    shape: state.cameraLost ? 'pill' : (state.shape ?? 'rect'),
    stopsRecording: false,
  };
}

// Injected as a classic content script; no module scope here.
globalThis.SnapRecWebcam = { overlayState, shapeFor, statusLabel };
