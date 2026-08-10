import { describe, expect, it } from 'vitest';
import { MAX_FADE_SHARE, clampFades, fadeOpacityAt } from '../fades';

describe('clamping fades to the footage', () => {
  it('leaves fades that comfortably fit', () => {
    expect(clampFades({ inSec: 0.3, outSec: 0.5 }, 100)).toEqual({ inSec: 0.3, outSec: 0.5 });
  });

  /** A 3s in and 3s out on a 4s clip never reaches full brightness: the clip
   * is dark at both ends and dim throughout, which reads as a broken export. */
  it('scales both down when they would swallow the clip', () => {
    const out = clampFades({ inSec: 3, outSec: 3 }, 4);
    expect(out.inSec + out.outSec).toBeCloseTo(4 * MAX_FADE_SHARE, 5);
  });

  it('keeps the ratio the user chose when scaling', () => {
    const out = clampFades({ inSec: 3, outSec: 1 }, 4);
    expect(out.inSec / out.outSec).toBeCloseTo(3, 5);
  });

  it('refuses negative durations', () => {
    expect(clampFades({ inSec: -2, outSec: 1 }, 100).inSec).toBe(0);
  });

  it('has nothing to clamp against an unknown length', () => {
    expect(clampFades({ inSec: 1, outSec: 1 }, 0)).toEqual({ inSec: 0, outSec: 0 });
  });
});

describe('opacity through the clip', () => {
  const fades = { inSec: 2, outSec: 4 };

  it('starts dark and reaches full brightness', () => {
    expect(fadeOpacityAt(10, 10, 100, fades)).toBe(0);
    expect(fadeOpacityAt(11, 10, 100, fades)).toBeCloseTo(0.5, 5);
    expect(fadeOpacityAt(12, 10, 100, fades)).toBe(1);
  });

  it('holds full brightness through the middle', () => {
    expect(fadeOpacityAt(50, 10, 100, fades)).toBe(1);
  });

  it('fades back out to dark at the end', () => {
    expect(fadeOpacityAt(98, 10, 100, fades)).toBeCloseTo(0.5, 5);
    expect(fadeOpacityAt(100, 10, 100, fades)).toBe(0);
  });

  /** A frame outside the kept range is not in the output; showing it bright
   * during a scrub would suggest otherwise. */
  it('shows nothing outside the kept range', () => {
    expect(fadeOpacityAt(5, 10, 100, fades)).toBe(0);
    expect(fadeOpacityAt(120, 10, 100, fades)).toBe(0);
  });

  it('is fully bright throughout when no fades are set', () => {
    expect(fadeOpacityAt(10, 10, 100, { inSec: 0, outSec: 0 })).toBe(1);
    expect(fadeOpacityAt(100, 10, 100, { inSec: 0, outSec: 0 })).toBe(1);
  });

  it('stays visible when the length is unknown', () => {
    expect(fadeOpacityAt(5, 0, 0, fades)).toBe(1);
  });
});
