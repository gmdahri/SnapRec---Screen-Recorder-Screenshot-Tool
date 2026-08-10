/** P7 E5.2 — measuring how loud a recording is, and how much to lift it.
 *
 * This is **RMS**, not LUFS. The mockup says "target −16 LUFS", and true LUFS
 * (ITU-R BS.1770) needs K-weighting filters and gated block analysis — a real
 * DSP implementation, not a shortcut. Reporting an RMS figure as LUFS would be
 * a number that looks authoritative and is not, so the label says RMS and the
 * target is expressed in dBFS.
 *
 * For screen recordings the difference matters less than it would for music:
 * the content is speech at a fairly constant level, which is the case where RMS
 * and LUFS track each other most closely. It is good enough to stop one
 * recording being twice as loud as the next, which is the actual complaint. */

/** Where speech sits comfortably without clipping headroom. */
export const TARGET_DBFS = -16;

/** Never amplify by more than this. A near-silent recording would otherwise be
 * lifted until its noise floor becomes the content. */
export const MAX_GAIN_DB = 12;

/** Below this there is nothing worth normalising — it is silence, not quiet. */
export const SILENCE_FLOOR_DBFS = -60;

export function rmsDbfs(samples: Float32Array): number | null {
  if (samples.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (!(rms > 0)) return null;
  return 20 * Math.log10(rms);
}

/** Linear multiplier to bring `measuredDbfs` to the target, or 1 when there is
 * nothing sensible to do. Clamped so normalising can only ever be a modest
 * correction, never a rescue of a recording with no usable audio. */
export function gainFor(measuredDbfs: number | null, targetDbfs = TARGET_DBFS): number {
  if (measuredDbfs === null) return 1;
  if (measuredDbfs <= SILENCE_FLOOR_DBFS) return 1;

  const deltaDb = Math.min(targetDbfs - measuredDbfs, MAX_GAIN_DB);
  return 10 ** (deltaDb / 20);
}

/** What the panel says: "−24.3 dBFS → −16.0 dBFS". Null when unmeasurable. */
export function describeLoudness(
  measuredDbfs: number | null,
  targetDbfs = TARGET_DBFS,
): string | null {
  if (measuredDbfs === null) return null;
  if (measuredDbfs <= SILENCE_FLOOR_DBFS) return 'too quiet to normalise';

  const applied = 20 * Math.log10(gainFor(measuredDbfs, targetDbfs));
  const reached = measuredDbfs + applied;
  return `${measuredDbfs.toFixed(1)} → ${reached.toFixed(1)} dBFS RMS`;
}
