import { mergeIntervals, type Interval } from '../../lib/intervals';
/** P7 E3.2 — the cut model: ranges of the source that the output leaves out.
 *
 * Cuts are stored as source-time ranges rather than as edits to a rendered
 * result, so they stay meaningful when the trim moves and can be undone
 * without re-rendering. Everything here is pure: the awkward parts are
 * overlap, adjacency and the trim boundary, none of which need a DOM.
 *
 * The merging itself lives in lib/intervals, shared with watch coverage.
 *
 * Invariant: a normalised cut list is sorted, non-overlapping, non-touching and
 * inside the clip. Everything downstream — output length, playback skipping,
 * the CUTS lane — assumes that, so `normalizeCuts` is the only way to build one. */

export interface Cut extends Interval {
  id: string;
}

/** Ranges closer than this are treated as one. Below a frame there is nothing
 * to keep between them, and two cuts a millisecond apart would render as two
 * unclickable chips on the timeline. */
export const MERGE_EPSILON_SEC = 1 / 30;

/** Sorted, clamped, merged. Zero-length and inverted ranges are dropped rather
 * than repaired: a cut that removes nothing is a mistake, not an instruction. */
export function normalizeCuts(cuts: Cut[], durationSec: number): Cut[] {
  if (!(durationSec > 0)) return [];

  const clamped = cuts.map(cut => ({
    ...cut,
    startSec: Math.max(0, Math.min(cut.startSec, durationSec)),
    endSec: Math.max(0, Math.min(cut.endSec, durationSec)),
  }));

  // Shared with watch coverage — see lib/intervals. The generic merge keeps the
  // earlier item's fields, which is what preserves a cut's id through a merge.
  return mergeIntervals(clamped, MERGE_EPSILON_SEC);
}

/** Total seconds removed inside the kept range. Cuts outside the trim are
 * ignored — they are already excluded by the trim itself, and counting them
 * would make the output look shorter than it plays. */
export function cutSecondsWithin(
  // The minimal shape, not Cut: neither this nor outputDurationSec reads `id`,
  // and the encoder holds already-normalised ranges without one.
  cuts: readonly { startSec: number; endSec: number }[],
  startSec: number,
  endSec: number,
): number {
  return cuts.reduce((total, cut) => {
    const from = Math.max(cut.startSec, startSec);
    const to = Math.min(cut.endSec, endSec);
    return total + Math.max(0, to - from);
  }, 0);
}

/** How long the export runs: the trim, less whatever the cuts remove from it. */
export function outputDurationSec(
  trimStartSec: number,
  trimEndSec: number,
  cuts: readonly { startSec: number; endSec: number }[],
): number {
  const kept = Math.max(0, trimEndSec - trimStartSec);
  return Math.max(0, kept - cutSecondsWithin(cuts, trimStartSec, trimEndSec));
}

export function cutAt(sec: number, cuts: Cut[]): Cut | null {
  return cuts.find(cut => sec >= cut.startSec && sec < cut.endSec) ?? null;
}

/** Where playback should continue from. Inside a cut it jumps to the end of it,
 * following through consecutive cuts — normalised lists never touch, but the
 * trim boundary can still land inside one.
 *
 * Returns null when the jump would land past the end of the kept range, which
 * is the caller's signal to stop rather than to seek. */
export function nextPlayableSec(sec: number, cuts: Cut[], trimEndSec: number): number | null {
  const cut = cutAt(sec, cuts);
  if (!cut) return sec;
  if (cut.endSec >= trimEndSec) return null;
  return cut.endSec;
}

/** True when a zoom (or any timed effect) sits entirely inside removed footage.
 * The editor uses this to warn rather than to delete: silently dropping
 * someone's zoom because a later cut swallowed it is worse than saying so. */
export function isFullyCut(startSec: number, endSec: number, cuts: Cut[]): boolean {
  return cuts.some(cut => startSec >= cut.startSec && endSec <= cut.endSec);
}
