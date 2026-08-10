import { describe, expect, it } from 'vitest';
import { coverageRatio, mergeIntervals, totalSeconds } from '../intervals';

const r = (startSec: number, endSec: number) => ({ startSec, endSec });

describe('merging ranges', () => {
  it('sorts and joins overlapping ranges', () => {
    expect(mergeIntervals([r(40, 50), r(10, 20), r(15, 25)]))
      .toEqual([r(10, 25), r(40, 50)]);
  });

  it('leaves separated ranges alone', () => {
    expect(mergeIntervals([r(10, 20), r(30, 40)])).toHaveLength(2);
  });

  it('drops ranges that cover nothing', () => {
    expect(mergeIntervals([r(10, 10), r(30, 20)])).toEqual([]);
  });

  /** A real gap of any size is a real gap for coverage; cuts pass a frame. */
  it('joins neighbours only within the epsilon it is given', () => {
    expect(mergeIntervals([r(10, 20), r(20.02, 30)])).toHaveLength(2);
    expect(mergeIntervals([r(10, 20), r(20.02, 30)], 1 / 30)).toHaveLength(1);
  });

  /** This is what preserves a cut's id through a merge. */
  it('keeps the earlier item’s fields when two merge', () => {
    const merged = mergeIntervals([
      { id: 'first', startSec: 10, endSec: 20 },
      { id: 'second', startSec: 12, endSec: 30 },
    ]);
    expect(merged).toEqual([{ id: 'first', startSec: 10, endSec: 30 }]);
  });

  it('does not mutate what it was given', () => {
    const input = [r(10, 20), r(12, 30)];
    mergeIntervals(input);
    expect(input[0].endSec).toBe(20);
  });
});

describe('how much time is covered', () => {
  it('counts overlapping time once', () => {
    expect(totalSeconds([r(0, 30), r(10, 40)])).toBe(40);
  });

  it('adds up separated ranges', () => {
    expect(totalSeconds([r(0, 10), r(50, 60)])).toBe(20);
  });

  it('is nothing for nothing', () => {
    expect(totalSeconds([])).toBe(0);
  });
});

describe('coverage of a clip', () => {
  it('is the share of the clip actually seen', () => {
    expect(coverageRatio([r(0, 45)], 180)).toBeCloseTo(0.25, 5);
  });

  /** Watching the same half twice is still half the video. */
  it('does not reward rewatching', () => {
    expect(coverageRatio([r(0, 90), r(0, 90)], 180)).toBeCloseTo(0.5, 5);
  });

  /** Skipping to the end is the case a high-water mark gets wrong. */
  it('reports a skip to the end as barely watched', () => {
    expect(coverageRatio([r(0, 2), r(178, 180)], 180)).toBeCloseTo(0.022, 3);
  });

  it('never exceeds the whole clip', () => {
    expect(coverageRatio([r(0, 500)], 180)).toBe(1);
  });

  it('is nothing when the clip has no known length', () => {
    expect(coverageRatio([r(0, 45)], 0)).toBe(0);
  });
});
