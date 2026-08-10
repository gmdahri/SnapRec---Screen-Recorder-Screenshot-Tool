import { describe, expect, it } from 'vitest';
import {
  MAX_GAIN_DB, SILENCE_FLOOR_DBFS, TARGET_DBFS,
  describeLoudness, gainFor, rmsDbfs,
} from '../loudness';

/** A steady tone at a known amplitude has a known RMS: peak / √2. */
const tone = (amplitude: number, n = 4096) =>
  Float32Array.from({ length: n }, (_, i) => Math.sin((i / n) * Math.PI * 2 * 50) * amplitude);

describe('measuring loudness', () => {
  it('reads a full-scale tone at about −3 dBFS', () => {
    expect(rmsDbfs(tone(1))!).toBeCloseTo(-3, 0);
  });

  it('reads a quieter tone as quieter', () => {
    expect(rmsDbfs(tone(0.1))!).toBeLessThan(rmsDbfs(tone(0.5))!);
  });

  it('has nothing to measure in silence or in nothing', () => {
    expect(rmsDbfs(new Float32Array(1000))).toBeNull();
    expect(rmsDbfs(new Float32Array(0))).toBeNull();
  });
});

describe('working out the gain', () => {
  it('lifts a quiet recording towards the target', () => {
    // -24 to -16 is +8 dB, inside the ceiling.
    const gain = gainFor(-24);
    expect(gain).toBeGreaterThan(1);
    expect(20 * Math.log10(gain)).toBeCloseTo(8, 1);
  });

  /** -30 to -16 would be +14 dB, which the ceiling refuses. */
  it('stops at the ceiling instead of reaching the target', () => {
    expect(20 * Math.log10(gainFor(-30))).toBeCloseTo(MAX_GAIN_DB, 5);
  });

  it('attenuates one that is too loud', () => {
    expect(gainFor(-6)).toBeLessThan(1);
  });

  /** Otherwise a near-silent recording is lifted until its noise floor becomes
   * the content — worse than leaving it quiet. */
  it('never amplifies beyond the ceiling', () => {
    expect(20 * Math.log10(gainFor(-80 + 21))).toBeLessThanOrEqual(MAX_GAIN_DB + 0.001);
  });

  it('leaves silence alone rather than trying to rescue it', () => {
    expect(gainFor(SILENCE_FLOOR_DBFS - 1)).toBe(1);
    expect(gainFor(null)).toBe(1);
  });

  it('does nothing to a recording already on target', () => {
    expect(gainFor(TARGET_DBFS)).toBeCloseTo(1, 5);
  });
});

describe('what the panel says', () => {
  it('states where it is and where it would land', () => {
    expect(describeLoudness(-24.3)).toBe('-24.3 → -16.0 dBFS RMS');
  });

  /** Naming it RMS matters: calling an RMS figure LUFS would be a number that
   * looks authoritative and is not. */
  it('never claims to be LUFS', () => {
    expect(describeLoudness(-24.3)).not.toMatch(/LUFS/);
  });

  it('says plainly when there is nothing to work with', () => {
    expect(describeLoudness(-70)).toBe('too quiet to normalise');
    expect(describeLoudness(null)).toBeNull();
  });
});
