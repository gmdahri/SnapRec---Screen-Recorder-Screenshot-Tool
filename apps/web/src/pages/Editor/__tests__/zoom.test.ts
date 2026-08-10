import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, clampZoom, fitZoom, parseZoomInput } from '../zoom';

const well = { width: 1200, height: 800 };

describe('fit zoom', () => {
  /** The reported bug: a 2x capture opened at 100% because the container was
   * never found, so it filled the well several times over. */
  it('shrinks a high-DPI capture to fit the well', () => {
    const zoom = fitZoom(well, { width: 2880, height: 1800 });
    expect(zoom).toBeLessThan(0.5);
    expect(2880 * zoom).toBeLessThanOrEqual(well.width - 100);
    expect(1800 * zoom).toBeLessThanOrEqual(well.height - 100);
  });

  it('never magnifies an image smaller than the well', () => {
    expect(fitZoom(well, { width: 400, height: 300 })).toBe(1);
  });

  it('fits by the tighter axis, so a tall capture fits vertically', () => {
    const zoom = fitZoom(well, { width: 800, height: 4000 });
    expect(4000 * zoom).toBeLessThanOrEqual(well.height - 100);
  });

  it('falls back to 1:1 when the container has not been measured yet', () => {
    expect(fitZoom({ width: 0, height: 0 }, { width: 2880, height: 1800 })).toBe(1);
  });

  it('falls back to 1:1 rather than dividing by a zero-sized image', () => {
    expect(fitZoom(well, { width: 0, height: 0 })).toBe(1);
  });

  it('never returns a zoom the controls cannot represent', () => {
    const zoom = fitZoom({ width: 120, height: 120 }, { width: 20000, height: 20000 });
    expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });
});

describe('typed zoom values', () => {
  it('reads a plain percentage', () => {
    expect(parseZoomInput('40')).toBeCloseTo(0.4);
  });

  it('reads the percent sign back, because the field displays one', () => {
    expect(parseZoomInput('40%')).toBeCloseTo(0.4);
    expect(parseZoomInput('  150 % ')).toBeCloseTo(1.5);
  });

  it('clamps beyond the supported range instead of rejecting', () => {
    expect(parseZoomInput('9000')).toBe(MAX_ZOOM);
    expect(parseZoomInput('1')).toBe(MIN_ZOOM);
  });

  it('returns null for text that is not a zoom, so the caller keeps the current one', () => {
    expect(parseZoomInput('')).toBeNull();
    expect(parseZoomInput('abc')).toBeNull();
    expect(parseZoomInput('-20')).toBeNull();
    expect(parseZoomInput('0')).toBeNull();
  });
});

describe('clamping', () => {
  it('holds the zoom inside the supported range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(0.75)).toBe(0.75);
  });
});
