/** Merging time ranges — server copy.
 *
 * DUPLICATED, deliberately. `apps/web/src/lib/intervals.ts` holds the same
 * function. The two apps are separate deployables with no shared runtime
 * package (`@snaprec/design-system` is UI only), and standing up a shared
 * package for twenty lines costs more than it saves.
 *
 * They must agree: the client merges ranges before sending them and the server
 * merges them again on arrival. If these two ever disagree about what counts as
 * overlapping, coverage drifts between what a viewer's browser believes and
 * what the database stores. Change both, or neither.
 *
 * The web copy is generic over the payload because cuts carry ids; the server
 * only ever merges plain ranges, so this one is not. */

export interface Interval {
  startSec: number;
  endSec: number;
}

export function mergeIntervals(items: Interval[]): Interval[] {
  const ordered = [...items]
    .filter((i) => i.endSec > i.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const merged: Interval[] = [];
  for (const item of ordered) {
    const last = merged[merged.length - 1];
    if (last && item.startSec <= last.endSec) {
      last.endSec = Math.max(last.endSec, item.endSec);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}
