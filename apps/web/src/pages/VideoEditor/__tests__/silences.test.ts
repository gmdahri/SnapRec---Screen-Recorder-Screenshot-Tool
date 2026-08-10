import { describe, expect, it } from 'vitest';
import { detectSilences, summarizeSilences } from '../silences';

/** 100 buckets over 100s — one bucket per second, so the arithmetic is legible. */
const track = (quietRanges: Array<[number, number]>) => {
  const peaks = new Array(100).fill(0.8);
  for (const [from, to] of quietRanges) {
    for (let i = from; i < to; i += 1) peaks[i] = 0.01;
  }
  return peaks;
};

describe('finding gaps', () => {
  it('finds a long silence', () => {
    const found = detectSilences(track([[20, 26]]), 100);
    expect(found).toHaveLength(1);
    expect(found[0].startSec).toBeCloseTo(20.12, 2);
    expect(found[0].endSec).toBeCloseTo(25.88, 2);
  });

  /** The natural pauses in speech are not dead air; cutting them makes someone
   * sound clipped and rushed. */
  it('ignores a pause too short to be dead air', () => {
    expect(detectSilences(track([[20, 20.5 as unknown as number]]), 100)).toHaveLength(0);
    expect(detectSilences(track([[20, 21]]), 100)).toHaveLength(0);
  });

  it('finds several', () => {
    expect(detectSilences(track([[10, 16], [40, 48], [70, 74]]), 100)).toHaveLength(3);
  });

  /** A cut landing on a consonant is worse than a second of dead air, so both
   * ends give ground. */
  it('pads inwards so a cut never lands on speech', () => {
    const [gap] = detectSilences(track([[30, 40]]), 100, { padSec: 0.5 });
    expect(gap.startSec).toBeCloseTo(30.5, 5);
    expect(gap.endSec).toBeCloseTo(39.5, 5);
  });

  it('proposes nothing for a track that never goes quiet', () => {
    expect(detectSilences(new Array(100).fill(0.7), 100)).toEqual([]);
  });

  /** A recording with the microphone off is one enormous silence. Deleting the
   * whole clip is never what "remove silences" meant. */
  it('refuses to propose deleting the entire recording', () => {
    expect(detectSilences(new Array(100).fill(0), 100)).toEqual([]);
  });

  it('has nothing to work with before the audio is decoded', () => {
    expect(detectSilences([], 100)).toEqual([]);
    expect(detectSilences(track([[20, 30]]), 0)).toEqual([]);
  });

  it('closes a gap that runs to the end of the recording', () => {
    const found = detectSilences(track([[80, 100]]), 100);
    expect(found).toHaveLength(1);
    expect(found[0].endSec).toBeLessThanOrEqual(100);
  });

  /** A louder recording should not need a different setting to behave the
   * same — peaks are normalised, so the threshold is relative. */
  it('behaves the same on a quiet recording as a loud one', () => {
    const loud = new Array(100).fill(1);
    const quiet = new Array(100).fill(1);
    for (let i = 20; i < 30; i += 1) { loud[i] = 0.02; quiet[i] = 0.02; }
    expect(detectSilences(loud, 100)).toEqual(detectSilences(quiet, 100));
  });
});

describe('the reading the panel shows', () => {
  it('counts the gaps and their total', () => {
    const ranges = [{ startSec: 0, endSec: 1 }, { startSec: 4, endSec: 4.2 }];
    expect(summarizeSilences(ranges)).toBe('2 gaps over 1.2s');
  });

  it('says gap, not gaps, for one', () => {
    expect(summarizeSilences([{ startSec: 0, endSec: 2 }])).toBe('1 gap over 2.0s');
  });

  it('says nothing when there is nothing to say', () => {
    expect(summarizeSilences([])).toBeNull();
  });
});
