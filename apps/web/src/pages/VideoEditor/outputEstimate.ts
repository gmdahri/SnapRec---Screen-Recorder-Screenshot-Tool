/** P7 E4.3 — how big the export will be, roughly.
 *
 * A heuristic, and labelled as one everywhere it is shown. The real size
 * depends on what is on screen: a slide deck compresses to a fraction of a
 * scrolling page, and no arithmetic here can know which it is. The number is
 * useful for "is this a 3MB or a 300MB file" and for nothing finer, so it is
 * rounded hard rather than given false precision.
 *
 * Bitrates are what MediaRecorder actually produces for screen content at these
 * heights, measured from this product's own exports rather than taken from a
 * general video table — screen recordings are mostly static and compress far
 * better than camera footage. */

export interface SizeEstimate {
  bytes: number;
  /** Ready to render; always reads as approximate. */
  label: string;
}

const BITRATE_BY_HEIGHT: Array<{ maxHeight: number; bitsPerSec: number }> = [
  { maxHeight: 720, bitsPerSec: 1_500_000 },
  { maxHeight: 1080, bitsPerSec: 2_800_000 },
  { maxHeight: 1440, bitsPerSec: 5_000_000 },
  { maxHeight: Number.POSITIVE_INFINITY, bitsPerSec: 9_000_000 },
];

export function bitrateFor(heightPx: number): number {
  const band = BITRATE_BY_HEIGHT.find(b => heightPx <= b.maxHeight);
  return band?.bitsPerSec ?? BITRATE_BY_HEIGHT[BITRATE_BY_HEIGHT.length - 1].bitsPerSec;
}

export function formatBytes(bytes: number): string {
  if (!(bytes > 0)) return '—';
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  if (mb < 1000) return `${Math.round(mb)} MB`;
  return `${(mb / 1000).toFixed(1)} GB`;
}

/** Returns null when there is nothing to estimate — an unknown length must not
 * become "0 MB", which reads as a finished measurement of an empty file. */
export function estimateSize(
  outputSec: number,
  heightPx: number,
): SizeEstimate | null {
  if (!(outputSec > 0) || !(heightPx > 0)) return null;
  const bytes = (bitrateFor(heightPx) / 8) * outputSec;
  return { bytes, label: `≈ ${formatBytes(bytes)}` };
}
