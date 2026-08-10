/** Where to sample preview frames along a recording.
 *
 * A filmstrip for navigation: enough frames to find the part you want, few
 * enough that generating them does not stall the page. Each frame is both a
 * picture and a jump target.
 *
 * Nothing is stored. Frames are drawn from the video already loaded in the
 * page, so this works on recordings captured long before the feature existed
 * and costs no upload, no storage and no migration. */

/** Aim for one frame per this many seconds. */
export const SECONDS_PER_FRAME = 20;

/** Ceiling. Each frame costs a seek and a decode, and a strip wider than this
 * is a contact sheet rather than a way to navigate. */
export const MAX_FRAMES = 12;

export interface FramePoint {
  /** Where clicking this frame seeks to — the start of the section it covers. */
  startSec: number;
  /** Where the picture is sampled from. Offset into the section, because the
   * exact boundary is often a cut or a fade and samples as black. */
  sampleSec: number;
}

/** How many frames a recording of this length gets.
 *
 * Always at least one while a length is known: a five-second clip still
 * deserves a picture, and returning none would leave the strip empty for
 * exactly the recordings that are quickest to preview. */
export function frameCount(durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return Math.min(MAX_FRAMES, Math.max(1, Math.ceil(durationSec / SECONDS_PER_FRAME)));
}

export function framePoints(durationSec: number): FramePoint[] {
  const count = frameCount(durationSec);
  if (count === 0) return [];

  const segment = durationSec / count;
  return Array.from({ length: count }, (_, i) => {
    const startSec = i * segment;
    // A tenth into the section, capped at half a second, so the sample clears
    // a cut on the boundary without drifting far from what it represents.
    const offset = Math.min(segment * 0.1, 0.5);
    return {
      startSec,
      sampleSec: Math.min(startSec + offset, Math.max(0, durationSec - 0.05)),
    };
  });
}
