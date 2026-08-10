import { describe, expect, it } from 'vitest';
import { buildTicks, chooseTickInterval, formatTick, xToSec } from '../timelineTicks';

describe('choosing a tick interval', () => {
  it('rules a three-minute clip in half-minutes on a wide timeline', () => {
    // 1300px / 64 ≈ 20 labels; 182s / 20 ≈ 9.1s → the ladder's 10s step.
    expect(chooseTickInterval(182, 1300)).toBe(10);
  });

  it('widens the interval when the same clip is drawn narrow', () => {
    expect(chooseTickInterval(182, 300)).toBeGreaterThan(chooseTickInterval(182, 1300));
  });

  /** A two-hour recording would otherwise want a step off the end of the
   * ladder; it takes the widest rather than returning nothing. */
  it('still rules an hours-long recording', () => {
    expect(chooseTickInterval(7200, 1300)).toBeGreaterThanOrEqual(300);
  });

  it('rules a very short clip in single seconds', () => {
    expect(chooseTickInterval(4.9, 1300)).toBe(1);
  });

  /** Unknown duration is the case every part of this editor has to survive. */
  it('declines to rule a clip of unknown length', () => {
    expect(chooseTickInterval(0, 1300)).toBe(0);
    expect(buildTicks(0, 1300)).toEqual([]);
  });

  it('declines before the timeline has been measured', () => {
    expect(chooseTickInterval(182, 0)).toBe(0);
    expect(buildTicks(182, 0)).toEqual([]);
  });
});

describe('the ticks themselves', () => {
  it('starts at zero and never runs past the clip', () => {
    const ticks = buildTicks(182, 1300);
    expect(ticks[0].sec).toBe(0);
    expect(ticks[ticks.length - 1].sec).toBeLessThanOrEqual(182);
  });

  it('places each tick at its share of the width', () => {
    const ticks = buildTicks(180, 1300);
    const ninety = ticks.find(t => t.sec === 90)!;
    expect(ninety.pct).toBeCloseTo(50, 5);
  });

  it('labels in the same clock the trim handles use', () => {
    expect(formatTick(0)).toBe('0:00');
    expect(formatTick(90)).toBe('1:30');
    // Floors, so a tick never claims a second the playhead has not reached.
    expect(formatTick(14.56)).toBe('0:14');
  });

  /** Caught by looking at a two-hour ruler: M:SS ended it at "120:00". */
  it('switches to hours rather than counting past sixty minutes', () => {
    expect(formatTick(3600)).toBe('1:00:00');
    expect(formatTick(7200)).toBe('2:00:00');
    expect(formatTick(3661)).toBe('1:01:01');
    expect(formatTick(3599)).toBe('59:59');
  });

  it('keeps labels far enough apart to read', () => {
    const widthPx = 1300;
    const ticks = buildTicks(182, widthPx);
    const gapPx = (ticks[1].pct - ticks[0].pct) / 100 * widthPx;
    expect(gapPx).toBeGreaterThanOrEqual(64);
  });
});

describe('clicking the ruler', () => {
  it('maps a position to a moment', () => {
    expect(xToSec(650, 1300, 182)).toBeCloseTo(91, 5);
  });

  it('never seeks past either end', () => {
    expect(xToSec(-40, 1300, 182)).toBe(0);
    expect(xToSec(9999, 1300, 182)).toBe(182);
  });

  it('stays at zero when there is nothing to seek within', () => {
    expect(xToSec(650, 1300, 0)).toBe(0);
  });
});
