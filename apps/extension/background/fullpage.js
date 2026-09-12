/** The arithmetic a full-page capture is made of.
 *
 * Two numbers decide whether this feature works. The first is how far the
 * capture must be scaled down to fit in a canvas the browser will actually
 * encode — past roughly 115 megapixels toDataURL/convertToBlob stop returning
 * anything, and they do it without throwing, so an unbudgeted capture fails as
 * a blank image rather than an error. The second is where each scrolled
 * section lands, which is not simply "one viewport further down": a page can
 * refuse to scroll a full viewport near the bottom, and the captured band then
 * repeats content already drawn.
 *
 * This is the CLASSIC-SCRIPT copy that importScripts loads — importScripts
 * cannot load an ES module, so background/fullpage.core.js holds the
 * identical bodies for the tests. tests/fullpage.test.js fails if the two
 * drift. */

/** Roughly 30% headroom under the ~115 MP ceiling measured in Chrome for
 * Testing 145. Memory-dependent rather than a constant of the platform, so
 * treat a recurrence of blank captures as "lower this", not "new bug". */
const PIXEL_BUDGET = 80_000_000;

/** How far to scale the capture so the canvas stays encodable.
 *
 * Area scales with the square of a linear factor, hence the square root.
 * Clamped to 1 because a short page must never be blown up. */
function budgetedScale({ pageW, pageH, dpr, budget = PIXEL_BUDGET }) {
  const natural = Math.max(1, pageW * dpr) * Math.max(1, pageH * dpr);
  if (!Number.isFinite(natural) || natural <= 0) return 1;
  return Math.min(1, Math.sqrt(budget / natural));
}

/** Device pixels for the stitched canvas, never smaller than 1x1. */
function canvasSize({ pageW, pageH, dpr, scale }) {
  return {
    width: Math.max(1, Math.floor(pageW * dpr * scale)),
    height: Math.max(1, Math.floor(pageH * dpr * scale)),
  };
}

/** Where one captured section belongs on the canvas, in CSS pixels.
 *
 * Returns null when the section carries nothing new — the page refused to
 * scroll, or scrolled backwards. Drawing those would duplicate a band; the
 * old code drew them and relied on a negative height to skip. */
function stitchPlan({ scrollY, prevScrollY, viewportH, isFirst }) {
  if (isFirst) return { sourceYCss: 0, drawHCss: viewportH, destYCss: 0 };

  const advanced = scrollY - prevScrollY;
  if (!(advanced > 0)) return null;

  const overlap = Math.max(0, viewportH - advanced);
  const drawHCss = viewportH - overlap;
  if (drawHCss <= 0) return null;

  return { sourceYCss: overlap, drawHCss, destYCss: prevScrollY + viewportH };
}

/** Preview-sized copy. The mini preview shows a card, never the full image. */
function thumbnailSize({ width, height, maxW = 480 }) {
  if (width <= maxW) return { width, height };
  const scale = maxW / width;
  return { width: maxW, height: Math.max(1, Math.round(height * scale)) };
}

// Loaded by importScripts into the service worker's global scope, and injected
// into the page ahead of content.js.
globalThis.SnapRecFullPage = {
  PIXEL_BUDGET, budgetedScale, canvasSize, stitchPlan, thumbnailSize,
};
