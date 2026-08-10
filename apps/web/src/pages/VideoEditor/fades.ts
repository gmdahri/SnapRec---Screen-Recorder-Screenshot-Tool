/** P7 E4.1 — fade in and fade out.
 *
 * Stored as two durations against the kept range, not as keyframes, because
 * that is what the panel offers and what an export needs. The preview applies
 * the same curve as a CSS opacity ramp, so what plays matches what renders.
 *
 * The awkward case is fades longer than the footage they are applied to. Left
 * alone, a 3s fade-in and 3s fade-out on a 4s clip overlap and the middle never
 * reaches full opacity — the clip is black at both ends and dim throughout,
 * which reads as a broken export rather than a long fade. They are scaled down
 * together instead, preserving their ratio, so the result is always a clip that
 * reaches full brightness at least momentarily. */

export interface Fades {
  inSec: number;
  outSec: number;
}

/** The longest share of the kept range the two fades may occupy between them.
 * Leaving a tenth at full brightness is what stops a fade reading as a dim clip. */
export const MAX_FADE_SHARE = 0.9;

export function clampFades(fades: Fades, keptSec: number): Fades {
  const inSec = Math.max(0, fades.inSec);
  const outSec = Math.max(0, fades.outSec);
  if (!(keptSec > 0)) return { inSec: 0, outSec: 0 };

  const budget = keptSec * MAX_FADE_SHARE;
  const total = inSec + outSec;
  if (total <= budget) return { inSec, outSec };

  // Scale together so the ratio the user chose survives.
  const scale = budget / total;
  return { inSec: inSec * scale, outSec: outSec * scale };
}

/** Opacity at a moment in source time, 0–1.
 *
 * Outside the kept range this returns 0: the frame is not part of the output,
 * and showing it at full brightness during a scrub would suggest it is. */
export function fadeOpacityAt(
  sec: number,
  trimStartSec: number,
  trimEndSec: number,
  fades: Fades,
): number {
  const kept = trimEndSec - trimStartSec;
  if (!(kept > 0)) return 1;
  if (sec < trimStartSec || sec > trimEndSec) return 0;

  const { inSec, outSec } = clampFades(fades, kept);

  if (inSec > 0 && sec < trimStartSec + inSec) {
    return (sec - trimStartSec) / inSec;
  }
  if (outSec > 0 && sec > trimEndSec - outSec) {
    return (trimEndSec - sec) / outSec;
  }
  return 1;
}
