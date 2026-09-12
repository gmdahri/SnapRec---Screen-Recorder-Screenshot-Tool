import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_JPEG_DIM, MAX_WEBP_DIM, PIXEL_BUDGET,
  budgetedScale, canvasSize, capturePlan, stitchPlan, thumbnailSize,
} from '../background/fullpage.core.js';

/** The arithmetic a full-page capture is made of.
 *
 * These tests exist because both of this feature's failures were silent. A
 * canvas past roughly 115 megapixels does not throw — toDataURL simply returns
 * an empty string, and the blank image sends successfully. And the overlap
 * maths that joins one scrolled section to the next has never had a test, so a
 * duplicated or dropped band of pixels would have looked like a rendering
 * quirk rather than a bug. */

describe('budgetedScale', () => {
  it('leaves an ordinary page at full resolution', () => {
    expect(budgetedScale({ pageW: 1200, pageH: 4000, dpr: 2 })).toBe(1);
  });

  it('never upscales a tiny page', () => {
    expect(budgetedScale({ pageW: 320, pageH: 400, dpr: 1 })).toBe(1);
  });

  it('scales a page down to fit the budget', () => {
    const s = budgetedScale({ pageW: 1200, pageH: 32000, dpr: 2 });
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThan(0);
    const px = (1200 * 2 * s) * (32000 * 2 * s);
    expect(px).toBeLessThanOrEqual(PIXEL_BUDGET * 1.001);
  });

  it('lands just under the budget at the boundary', () => {
    // Exactly the budget: no scaling needed.
    const pageW = 2000, pageH = PIXEL_BUDGET / (2000 * 1 * 1), dpr = 1;
    expect(budgetedScale({ pageW, pageH, dpr })).toBe(1);
  });

  it('honours an explicit budget', () => {
    expect(budgetedScale({ pageW: 1000, pageH: 1000, dpr: 1, budget: 250_000 })).toBeCloseTo(0.5, 5);
  });

  it('never returns zero, NaN or a negative for degenerate input', () => {
    for (const args of [
      { pageW: 0, pageH: 0, dpr: 1 },
      { pageW: 1200, pageH: 0, dpr: 2 },
      { pageW: 1200, pageH: 4000, dpr: 0 },
    ]) {
      const s = budgetedScale(args);
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('canvasSize', () => {
  it('multiplies css pixels by dpr and scale, rounding down', () => {
    expect(canvasSize({ pageW: 1200, pageH: 4000, dpr: 2, scale: 1 }))
      .toEqual({ width: 2400, height: 8000 });
  });

  it('applies the scale', () => {
    expect(canvasSize({ pageW: 1200, pageH: 4000, dpr: 2, scale: 0.5 }))
      .toEqual({ width: 1200, height: 4000 });
  });

  it('never produces a zero dimension', () => {
    const s = canvasSize({ pageW: 1, pageH: 1, dpr: 0.1, scale: 0.1 });
    expect(s.width).toBeGreaterThanOrEqual(1);
    expect(s.height).toBeGreaterThanOrEqual(1);
  });
});

describe('stitchPlan', () => {
  const viewportH = 800;

  it('draws the first section whole, at the top', () => {
    expect(stitchPlan({ scrollY: 0, prevScrollY: null, viewportH, isFirst: true }))
      .toEqual({ sourceYCss: 0, drawHCss: 800, destYCss: 0 });
  });

  it('draws a cleanly-advanced section with no overlap', () => {
    expect(stitchPlan({ scrollY: 800, prevScrollY: 0, viewportH, isFirst: false }))
      .toEqual({ sourceYCss: 0, drawHCss: 800, destYCss: 800 });
  });

  it('trims the overlap when the page could not scroll a full viewport', () => {
    // The last section of a page that ran out of room: it only advanced 300px,
    // so the top 500px of this capture repeats content already drawn.
    expect(stitchPlan({ scrollY: 1100, prevScrollY: 800, viewportH, isFirst: false }))
      .toEqual({ sourceYCss: 500, drawHCss: 300, destYCss: 1600 });
  });

  it('skips a section that could not scroll at all', () => {
    expect(stitchPlan({ scrollY: 800, prevScrollY: 800, viewportH, isFirst: false })).toBeNull();
  });

  it('skips a section that somehow scrolled backwards', () => {
    expect(stitchPlan({ scrollY: 700, prevScrollY: 800, viewportH, isFirst: false })).toBeNull();
  });

  it('places every section so the seams abut exactly', () => {
    // Three sections of a 2000px page: 0, 800, 1200 (clamped at the bottom).
    const a = stitchPlan({ scrollY: 0, prevScrollY: null, viewportH, isFirst: true });
    const b = stitchPlan({ scrollY: 800, prevScrollY: 0, viewportH, isFirst: false });
    const c = stitchPlan({ scrollY: 1200, prevScrollY: 800, viewportH, isFirst: false });
    expect(a.destYCss + a.drawHCss).toBe(b.destYCss);
    expect(b.destYCss + b.drawHCss).toBe(c.destYCss);
    expect(c.destYCss + c.drawHCss).toBe(2000);
  });
});

describe('thumbnailSize', () => {
  it('scales a wide capture down to the preview width', () => {
    expect(thumbnailSize({ width: 2400, height: 8000 })).toEqual({ width: 480, height: 1600 });
  });

  it('never enlarges a capture already narrower than the preview', () => {
    expect(thumbnailSize({ width: 300, height: 200 })).toEqual({ width: 300, height: 200 });
  });

  it('keeps at least one pixel of height for an extremely wide capture', () => {
    expect(thumbnailSize({ width: 10000, height: 5 }).height).toBeGreaterThanOrEqual(1);
  });
});

describe('capturePlan', () => {
  /** WebP cannot exceed 16383 pixels in either direction, and convertToBlob
   * does not refuse an oversized canvas — it silently returns a CROPPED image.
   * A 16,000px page at dpr 2 came back with half its height missing and no
   * error anywhere, which is the same class of silent truncation this feature
   * was rewritten to eliminate. */

  it('keeps a short page in webp at full resolution', () => {
    const p = capturePlan({ pageW: 1200, pageH: 4000, dpr: 2 });
    expect(p).toEqual({ scale: 1, mimeType: 'image/webp', width: 2400, height: 8000 });
  });

  it('switches to jpeg rather than cropping a page taller than webp allows', () => {
    const p = capturePlan({ pageW: 1200, pageH: 16000, dpr: 2 });
    expect(p.mimeType).toBe('image/jpeg');
    // Full resolution is retained: 2400x32000 is 76.8MP, inside the budget,
    // and 32000 is comfortably inside jpeg's 65535 limit.
    expect(p.scale).toBe(1);
    expect(p.height).toBe(32000);
  });

  it('never emits a dimension the chosen format would crop', () => {
    for (const pageH of [4000, 8000, 16000, 32000, 64000, 120000]) {
      const p = capturePlan({ pageW: 1200, pageH, dpr: 2 });
      const limit = p.mimeType === 'image/webp' ? MAX_WEBP_DIM : MAX_JPEG_DIM;
      expect(p.width).toBeLessThanOrEqual(limit);
      expect(p.height).toBeLessThanOrEqual(limit);
    }
  });

  it('still respects the megapixel budget after choosing a format', () => {
    for (const pageH of [4000, 32000, 64000, 120000]) {
      const p = capturePlan({ pageW: 1200, pageH, dpr: 2 });
      expect(p.width * p.height).toBeLessThanOrEqual(PIXEL_BUDGET * 1.001);
    }
  });

  it('downscales an enormous page rather than returning nothing', () => {
    const p = capturePlan({ pageW: 1200, pageH: 120000, dpr: 2 });
    expect(p.scale).toBeGreaterThan(0);
    expect(p.scale).toBeLessThan(1);
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);
  });

  it('handles a very wide page the same way', () => {
    const p = capturePlan({ pageW: 20000, pageH: 800, dpr: 2 });
    const limit = p.mimeType === 'image/webp' ? MAX_WEBP_DIM : MAX_JPEG_DIM;
    expect(p.width).toBeLessThanOrEqual(limit);
  });
});

describe('the classic-script copy', () => {
  it('has not drifted from the tested module', () => {
    // Order matters: strip the whole `export { ... };` block BEFORE stripping
    // a leading `export ` keyword, or the first rule eats the keyword and
    // leaves an orphaned brace list behind.
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecFullPage[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/fullpage.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/fullpage.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
