/** Zoom arithmetic for the screenshot editor, kept out of the Fabric hook so it
 * can be tested without a canvas.
 *
 * The fit used to be computed against `document.querySelector('.canvas-bg')`.
 * That class stopped existing when the canvas well was rebuilt, so the lookup
 * returned null, the fit branch never ran, and every screenshot opened at 100%
 * — which on a 2x capture is far past the edge of the well. Measuring is now
 * the caller's job (it holds a ref); this module only does the arithmetic. */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

/** Breathing room so the artboard never touches the walls of the well. */
export const FIT_PADDING = 100;

export interface Size {
  width: number;
  height: number;
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** The zoom that shows the whole image inside the well.
 *
 * Capped at 1: a screenshot smaller than the well is shown at its true size
 * rather than blown up, because magnifying a capture past 1:1 only softens it.
 * An unmeasured container (0 width during the first paint) falls back to 1:1
 * instead of dividing by zero. */
export function fitZoom(container: Size, image: Size, padding = FIT_PADDING): number {
  if (!(container.width > 0 && container.height > 0)) return 1;
  if (!(image.width > 0 && image.height > 0)) return 1;

  const availableWidth = container.width - padding;
  const availableHeight = container.height - padding;
  if (availableWidth <= 0 || availableHeight <= 0) return MIN_ZOOM;

  return clampZoom(Math.min(availableWidth / image.width, availableHeight / image.height, 1));
}

/** Reads what someone typed into the zoom field.
 *
 * Accepts "40", "40%", " 40 % " and decimals, since the field shows a percentage
 * and people type the symbol back. Returns a zoom factor, or null when the text
 * is not a number — the caller keeps the current zoom rather than jumping to
 * something arbitrary. */
export function parseZoomInput(text: string): number | null {
  const cleaned = text.replace(/%/g, '').trim();
  if (cleaned === '') return null;

  const percent = Number(cleaned);
  if (!Number.isFinite(percent) || percent <= 0) return null;

  return clampZoom(percent / 100);
}
