import { describe, expect, it } from 'vitest';
import { bitrateFor, estimateSize, formatBytes } from '../outputEstimate';

describe('picking a bitrate', () => {
  it('rises with the frame height', () => {
    expect(bitrateFor(720)).toBeLessThan(bitrateFor(1080));
    expect(bitrateFor(1080)).toBeLessThan(bitrateFor(1440));
  });

  it('has a band for anything taller than the table', () => {
    expect(bitrateFor(4320)).toBeGreaterThan(0);
  });
});

describe('rendering a size', () => {
  it('uses KB below a megabyte', () => {
    expect(formatBytes(400_000)).toBe('400 KB');
  });

  it('keeps one decimal while the number is small', () => {
    expect(formatBytes(26_800_000)).toBe('26.8 MB');
  });

  /** False precision on a heuristic is worse than none. */
  it('drops the decimal once the number is large', () => {
    expect(formatBytes(450_000_000)).toBe('450 MB');
    expect(formatBytes(2_400_000_000)).toBe('2.4 GB');
  });

  it('has nothing to show for nothing', () => {
    expect(formatBytes(0)).toBe('—');
  });
});

describe('estimating an export', () => {
  it('scales with how long the output runs', () => {
    const short = estimateSize(60, 1080)!;
    const long = estimateSize(120, 1080)!;
    expect(long.bytes).toBeCloseTo(short.bytes * 2, 5);
  });

  it('always reads as approximate', () => {
    expect(estimateSize(101, 1080)!.label.startsWith('≈')).toBe(true);
  });

  /** "0 MB" reads as a finished measurement of an empty file. */
  it('declines to estimate an output of unknown length', () => {
    expect(estimateSize(0, 1080)).toBeNull();
    expect(estimateSize(60, 0)).toBeNull();
  });

  it('lands in a believable range for a real clip', () => {
    // 1:41 of 1080p screen content.
    const estimate = estimateSize(101, 1080)!;
    expect(estimate.bytes / 1_000_000).toBeGreaterThan(10);
    expect(estimate.bytes / 1_000_000).toBeLessThan(100);
  });
});
