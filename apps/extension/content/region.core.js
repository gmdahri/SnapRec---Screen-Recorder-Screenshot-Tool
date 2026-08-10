/** In-page region selection (P1).
 *
 * Pure geometry, so the clamping and nudge rules are testable without a page.
 * content/region.js is the classic-script twin the content script loads —
 * __tests__/region.test.js fails if the two drift. */

function clampRect(rect, viewport) {
  const w = Math.min(rect.w, viewport.w);
  const h = Math.min(rect.h, viewport.h);
  return {
    x: Math.min(Math.max(rect.x, 0), viewport.w - w),
    y: Math.min(Math.max(rect.y, 0), viewport.h - h),
    w,
    h,
  };
}

/** Arrows move by one, shift-arrows by ten. Keyboard is first-class: a region
 * you can only drag is unreachable, and pixel-exact framing by mouse alone is
 * miserable. */
function nudge(rect, key, shiftKey) {
  const step = shiftKey ? 10 : 1;
  switch (key) {
    case 'ArrowLeft': return { ...rect, x: rect.x - step };
    case 'ArrowRight': return { ...rect, x: rect.x + step };
    case 'ArrowUp': return { ...rect, y: rect.y - step };
    case 'ArrowDown': return { ...rect, y: rect.y + step };
    default: return rect;
  }
}

/** A true multiplication sign, not an x. The dimensions read as a measurement
 * rather than a variable name. */
function formatDimensions(rect) {
  return `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
}

/** Which corner the magnifier follows — the one being dragged, so the
 * magnified pixels are the ones under the cursor. */
function magnifierCorner(rect, pointer) {
  const right = pointer.x > rect.x + rect.w / 2;
  const bottom = pointer.y > rect.y + rect.h / 2;
  return `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`;
}

export { clampRect, nudge, formatDimensions, magnifierCorner };
