/** P7 E5.1 — finding the gaps worth removing.
 *
 * Runs over the display peaks the AUDIO lane already computed, so detection
 * costs nothing extra: the file has been decoded once and the buckets are in
 * memory. The threshold is therefore relative to the loudest moment in the
 * recording rather than an absolute dBFS figure — those peaks are normalised,
 * and a quiet screen share and a loud one should behave the same.
 *
 * The bias throughout is towards proposing too little. A missed gap costs a
 * second of dead air; a wrong one clips the start of a sentence, and the person
 * reviewing has to notice it before it ships. */

export interface SilenceRange {
  startSec: number;
  endSec: number;
}

export interface SilenceOptions {
  /** Share of the loudest peak below which a bucket counts as quiet. */
  threshold?: number;
  /** Gaps shorter than this are the natural pauses in speech, not dead air. */
  minDurationSec?: number;
  /** Left at each end of a gap so a cut never lands on a consonant. */
  padSec?: number;
}

export const DEFAULT_SILENCE: Required<SilenceOptions> = {
  threshold: 0.06,
  minDurationSec: 0.8,
  padSec: 0.12,
};

export function detectSilences(
  peaks: number[],
  durationSec: number,
  options: SilenceOptions = {},
): SilenceRange[] {
  const { threshold, minDurationSec, padSec } = { ...DEFAULT_SILENCE, ...options };
  if (peaks.length === 0 || !(durationSec > 0)) return [];

  const bucketSec = durationSec / peaks.length;
  const found: SilenceRange[] = [];

  let runStart: number | null = null;
  for (let i = 0; i <= peaks.length; i += 1) {
    const quiet = i < peaks.length && peaks[i] <= threshold;

    if (quiet && runStart === null) runStart = i;

    if (!quiet && runStart !== null) {
      const rawStart = runStart * bucketSec;
      const rawEnd = i * bucketSec;
      // Padding is taken off both ends, so a gap only survives if it is longer
      // than the pause threshold *and* the padding it gives back.
      const startSec = rawStart + padSec;
      const endSec = rawEnd - padSec;
      if (endSec - startSec >= minDurationSec) found.push({ startSec, endSec });
      runStart = null;
    }
  }

  // A recording with no audio at all reads as one enormous silence. Proposing
  // to delete the entire clip is never what someone meant by "remove silences",
  // so a proposal that swallows nearly everything is discarded instead.
  const proposed = found.reduce((total, r) => total + (r.endSec - r.startSec), 0);
  if (proposed >= durationSec * 0.95) return [];

  return found;
}

/** The reading the panel shows: "6 gaps over 1.2s". */
export function summarizeSilences(ranges: SilenceRange[]): string | null {
  if (ranges.length === 0) return null;
  const total = ranges.reduce((sum, r) => sum + (r.endSec - r.startSec), 0);
  const gaps = `${ranges.length} gap${ranges.length === 1 ? '' : 's'}`;
  return `${gaps} over ${total.toFixed(1)}s`;
}
