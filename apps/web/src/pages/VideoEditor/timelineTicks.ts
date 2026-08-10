/** P7 E2.1 — where the ruler puts its marks.
 *
 * Kept pure so the awkward cases can be tested without a DOM: a two-second
 * clip, a two-hour one, and the unknown-duration case that every other part of
 * the editor has to survive.
 *
 * The rule is legibility, not arithmetic tidiness: labels are spaced by pixels,
 * so the same clip ruled across 400px and 1600px gets different intervals. */

/** Intervals people read fluently on a clock. 7s or 12s would divide evenly and
 * still be unreadable, so the ladder is fixed rather than computed. */
const LADDER_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

/** Minimum pixels between two labels before they crowd. */
export const MIN_LABEL_PX = 64;

export interface Tick {
  sec: number;
  label: string;
  /** Position along the ruler, 0–100. */
  pct: number;
}

/** Timecodes FLOOR — at 14.56s you are still inside the 14th second. Matches
 * the trim handles, which would otherwise disagree with the ruler above them. */
export function formatTick(sec: number): string {
  const total = Math.floor(sec);
  const ss = String(total % 60).padStart(2, '0');
  // Past an hour, minutes-only reads as nonsense: a two-hour recording ruled
  // in M:SS ends at "120:00", which nobody parses as two hours.
  if (total >= 3600) {
    return `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${ss}`;
  }
  return `${Math.floor(total / 60)}:${ss}`;
}

export function chooseTickInterval(
  durationSec: number,
  widthPx: number,
  minLabelPx: number = MIN_LABEL_PX,
): number {
  if (!(durationSec > 0) || !(widthPx > 0)) return 0;

  const maxLabels = Math.max(1, Math.floor(widthPx / minLabelPx));
  const idealSec = durationSec / maxLabels;

  // The first ladder step at or above the ideal spacing; the widest step when
  // even an hour would crowd, so a very long recording still gets a ruler.
  return LADDER_SEC.find(step => step >= idealSec) ?? LADDER_SEC[LADDER_SEC.length - 1];
}

export function buildTicks(
  durationSec: number,
  widthPx: number,
  minLabelPx: number = MIN_LABEL_PX,
): Tick[] {
  const interval = chooseTickInterval(durationSec, widthPx, minLabelPx);
  // No ruler at all until the clip reports a length. A ruler over an unknown
  // duration is a scale with no units — worse than no ruler.
  if (interval === 0) return [];

  const ticks: Tick[] = [];
  for (let sec = 0; sec <= durationSec + 1e-9; sec += interval) {
    ticks.push({ sec, label: formatTick(sec), pct: (sec / durationSec) * 100 });
  }
  return ticks;
}

/** Where a click on the ruler lands, in seconds. Clamped: a drag that leaves
 * the track must not seek past either end. */
export function xToSec(offsetPx: number, widthPx: number, durationSec: number): number {
  if (!(widthPx > 0) || !(durationSec > 0)) return 0;
  const ratio = Math.min(Math.max(offsetPx / widthPx, 0), 1);
  return ratio * durationSec;
}
