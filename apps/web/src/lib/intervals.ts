/** Merging time ranges.
 *
 * Two features need the same arithmetic and must not each grow their own copy:
 * cuts (ranges removed from the output) and watch coverage (ranges a viewer
 * actually saw). They differ only in what they carry alongside the times and in
 * how close two ranges must be before they count as one.
 *
 * Generic over the payload so the caller's identity survives a merge — cuts
 * keep their ids, coverage rows keep whatever they carry.
 *
 * DUPLICATED on the server at apps/server/src/recordings/intervals.ts. The two
 * apps are separate deployables with no shared runtime package. The client
 * merges watched ranges before sending and the server merges again on arrival;
 * if the two ever disagree about what counts as overlapping, coverage drifts
 * between browser and database. Change both, or neither. */

export interface Interval {
  startSec: number;
  endSec: number;
}

/** Sorted, non-overlapping, non-touching.
 *
 * When two ranges merge, the **earlier** item's fields are kept and only its
 * end is extended. Minting a new object would break anything holding a
 * reference to the range it merged into.
 *
 * `epsilonSec` is the gap below which neighbours are treated as one. Zero for
 * coverage, where a real gap of any size is a real gap; a frame for cuts, where
 * nothing playable can survive between two ranges that close together. */
export function mergeIntervals<T extends Interval>(items: T[], epsilonSec = 0): T[] {
  const ordered = [...items]
    .filter(i => i.endSec > i.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const merged: T[] = [];
  for (const item of ordered) {
    const last = merged[merged.length - 1];
    if (last && item.startSec <= last.endSec + epsilonSec) {
      last.endSec = Math.max(last.endSec, item.endSec);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

/** Seconds covered by a set of ranges, counting overlaps once. */
export function totalSeconds(items: Interval[]): number {
  return mergeIntervals(items).reduce((sum, i) => sum + (i.endSec - i.startSec), 0);
}

/** Share of a clip these ranges cover, 0–1.
 *
 * Clamped at 1, but a value above 1 before clamping means distinct watched
 * seconds exceeded the clip's length, which is arithmetically impossible —
 * treat it as a defect upstream rather than a rounding artefact. */
export function coverageRatio(items: Interval[], durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return Math.min(1, totalSeconds(items) / durationSec);
}
