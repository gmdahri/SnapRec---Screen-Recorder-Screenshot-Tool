import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, gridColumns, rowColumns, touchTarget } from '../useBreakpoint';

describe('the responsive ladder', () => {
  it('has exactly four rungs', () => {
    expect(Object.keys(BREAKPOINTS)).toEqual([
      'mobile', 'tabletPortrait', 'tabletLandscape', 'desktop',
    ]);
    expect(BREAKPOINTS).toEqual({
      mobile: 0, tabletPortrait: 768, tabletLandscape: 1024, desktop: 1280,
    });
  });

  it('steps the grid 4 → 3 → 2, then abandons it below 768', () => {
    expect(gridColumns('desktop')).toBe(4);
    expect(gridColumns('tabletLandscape')).toBe(3);
    expect(gridColumns('tabletPortrait')).toBe(2);
    expect(gridColumns('mobile')).toBe(0);
  });

  it('steps the list 9 → 7 → 5', () => {
    expect(rowColumns('desktop')).toBe(9);
    expect(rowColumns('tabletLandscape')).toBe(7);
    expect(rowColumns('tabletPortrait')).toBe(5);
  });

  it('raises touch targets to 40 on tablet portrait and 44 on mobile', () => {
    expect(touchTarget('desktop')).toBe(32);
    expect(touchTarget('tabletLandscape')).toBe(32);
    expect(touchTarget('tabletPortrait')).toBe(40);
    expect(touchTarget('mobile')).toBe(44);
  });
});
