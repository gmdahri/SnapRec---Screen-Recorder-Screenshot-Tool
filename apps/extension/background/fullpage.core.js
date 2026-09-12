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
 * This is the ESM copy, imported only by the tests. background/fullpage.js is
 * the classic-script twin that importScripts loads — tests/fullpage.test.js
 * fails if the two drift. */

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

/** Hard per-dimension limits of the encoders.
 *
 * convertToBlob does not refuse a canvas larger than the format allows — it
 * silently returns a CROPPED image. A 16,000px page at dpr 2 came back with
 * half its height missing and nothing logged anywhere. */
const MAX_WEBP_DIM = 16383;
const MAX_JPEG_DIM = 65535;

/** Scale and format for one capture, decided together.
 *
 * They are interdependent: webp is smaller and preferred, but cannot exceed
 * 16383px, and forcing a tall page to fit that would shrink a 16,000px page to
 * a quarter of its width. jpeg reaches 65535px, so a tall page keeps its
 * resolution by changing container rather than by losing pixels. The area
 * budget still applies on top, because the canvas itself stops encoding long
 * before either format's limit. */
function capturePlan({ pageW, pageH, dpr, budget = PIXEL_BUDGET }) {
  const areaScale = budgetedScale({ pageW, pageH, dpr, budget });
  const w = pageW * dpr * areaScale;
  const h = pageH * dpr * areaScale;

  const fitsWebp = w <= MAX_WEBP_DIM && h <= MAX_WEBP_DIM;
  const mimeType = fitsWebp ? 'image/webp' : 'image/jpeg';
  const maxDim = fitsWebp ? MAX_WEBP_DIM : MAX_JPEG_DIM;

  const dimScale = Math.min(1, maxDim / Math.max(1, w, h));
  const scale = areaScale * dimScale;

  return { scale, mimeType, ...canvasSize({ pageW, pageH, dpr, scale }) };
}

export {
  MAX_JPEG_DIM, MAX_WEBP_DIM, PIXEL_BUDGET,
  budgetedScale, canvasSize, capturePlan, stitchPlan, thumbnailSize,
};
