/** P7 E2.5 — turning a recording's audio into the AUDIO lane's bars.
 *
 * The arithmetic is separated from the Web Audio call so the awkward cases —
 * silence, a track with no audio at all, fewer samples than buckets — are
 * testable without decoding a real file.
 *
 * The lane exists to help someone find where the talking is. That is why the
 * bars are normalised for display: a quietly-recorded screen share has real
 * peaks around 0.05, and drawn at true scale it is a flat line that locates
 * nothing. The raw peaks are kept separate so nothing downstream mistakes the
 * display scaling for a loudness measurement. */

export const DEFAULT_BUCKETS = 400;

/** Longest file worth decoding in the tab. Decoding is synchronous inside the
 * audio thread and holds the whole PCM buffer in memory — around 10MB a minute
 * at 44.1kHz stereo — so an hour-long recording would cost roughly 600MB for a
 * decorative strip. Past this the lane stays empty rather than freezing. */
export const MAX_DECODE_SEC = 20 * 60;

/** Peak absolute amplitude per bucket, in the source's own scale (0–1). */
export function computePeaks(samples: Float32Array, buckets = DEFAULT_BUCKETS): number[] {
  if (buckets <= 0 || samples.length === 0) return [];

  // More buckets than samples would leave empty ones reading as silence.
  const count = Math.min(buckets, samples.length);
  const size = samples.length / count;
  const peaks: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const from = Math.floor(i * size);
    const to = Math.min(Math.floor((i + 1) * size), samples.length);
    let peak = 0;
    for (let j = from; j < to; j += 1) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  return peaks;
}

/** Scales peaks so the loudest reaches 1. Display only — see the note above.
 * All-silent input stays silent rather than being amplified into noise. */
export function normalizePeaks(peaks: number[]): number[] {
  const loudest = peaks.reduce((m, p) => (p > m ? p : m), 0);
  if (loudest <= 0) return peaks.map(() => 0);
  return peaks.map(p => p / loudest);
}

export interface DecodeLike {
  duration: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/** Reduces a decoded buffer to display bars, or an empty lane when there is no
 * audio to show. A screen recording made with the microphone off decodes
 * cleanly into zero channels, and an empty lane is the honest result. */
export function peaksFromBuffer(
  buffer: DecodeLike,
  buckets = DEFAULT_BUCKETS,
): number[] {
  if (buffer.numberOfChannels === 0) return [];
  if (buffer.duration > MAX_DECODE_SEC) return [];
  return normalizePeaks(computePeaks(buffer.getChannelData(0), buckets));
}
