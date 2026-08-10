import { describe, expect, it } from 'vitest';
import { getActiveZoom, AUTO_ZOOM_SCALE, ZOOM_DURATION_MS, TRANSITION_MS } from '../zoomUtils';
import type { ZoomKeyframe } from '../types';

/** getActiveZoom is the single resolver behind BOTH the live preview
 * (EditorWorkspace's rAF loop) and the encoder (localVideoTrim's canvas
 * pipeline). Pinning it here pins what actually lands in the exported file.
 *
 * Verified in a browser against a real 8s webm: with a manual keyframe at
 * 5.5s and a trim of 4.2–7.0s, the encoded output measured 199px for the
 * clip's marker at a moment with no zoom active and 260px inside the
 * keyframe's plateau — a ratio of 1.306 against AUTO_ZOOM_SCALE's 1.3. */

const CLICK_AT_1S = [
  { type: 'mousedown', timestamp: 1000, x: 300, y: 400, viewportWidth: 1280, viewportHeight: 720 },
];

const keyframe = (over: Partial<ZoomKeyframe> = {}): ZoomKeyframe => ({
  id: 'z1', timestamp: 5500, x: 50, y: 50,
  scale: AUTO_ZOOM_SCALE, duration: ZOOM_DURATION_MS, source: 'manual', ...over,
});

describe('what the encoder bakes in', () => {
  it('reaches the keyframe scale on the plateau', () => {
    const zoom = getActiveZoom(5500 + TRANSITION_MS + 100, [keyframe()], [], false);
    expect(zoom?.scale).toBeCloseTo(AUTO_ZOOM_SCALE, 3);
  });

  it('applies nothing between the auto window and the keyframe', () => {
    // Source 4.4s: the 1.0s click's window closed at 4.0s, the keyframe opens
    // at 5.5s. This is the control frame the browser run measured at 199px.
    expect(getActiveZoom(4400, [keyframe()], CLICK_AT_1S, true)).toBeNull();
  });

  it('lets a keyframe win over an overlapping auto suggestion', () => {
    // Both cover 1.5s. A keyframe is an accepted, edited decision; auto is a
    // guess, and the encoder must not blend or double-apply them.
    const kf = keyframe({ timestamp: 1000, scale: 2.4 });
    const zoom = getActiveZoom(1000 + TRANSITION_MS + 100, [kf], CLICK_AT_1S, true);
    expect(zoom?.scale).toBeCloseTo(2.4, 3);
  });

  it('honours the keyframe pivot rather than the click position', () => {
    const zoom = getActiveZoom(6200, [keyframe({ x: 70, y: 35 })], CLICK_AT_1S, true);
    expect(zoom?.originX).toBe(70);
    expect(zoom?.originY).toBe(35);
  });

  it('clamps a pivot that would swing the frame off its edge', () => {
    const zoom = getActiveZoom(6200, [keyframe({ x: 2, y: 99 })], [], false);
    expect(zoom?.originX).toBe(15);
    expect(zoom?.originY).toBe(85);
  });

  it('stops zooming once the keyframe window closes', () => {
    expect(getActiveZoom(5500 + ZOOM_DURATION_MS + 10, [keyframe()], [], false)).toBeNull();
  });

  it('still applies auto zoom when there are no keyframes', () => {
    const zoom = getActiveZoom(1000 + TRANSITION_MS + 100, [], CLICK_AT_1S, true);
    expect(zoom?.scale).toBeCloseTo(AUTO_ZOOM_SCALE, 3);
  });

  it('applies nothing when auto zoom is off and there are no keyframes', () => {
    expect(getActiveZoom(1500, [], CLICK_AT_1S, false)).toBeNull();
  });
});
