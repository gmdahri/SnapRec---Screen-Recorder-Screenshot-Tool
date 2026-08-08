/** In-page webcam overlay (P2).
 *
 * Pure state derivation, so the four rules the prototype names are testable
 * without a camera. content/webcam.js is the classic-script twin the content
 * script loads — __tests__/webcam.test.js fails if the two drift. */

const SHAPES = {
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

export { overlayState, shapeFor, statusLabel };
