/** Shrinking a screen recording down to a card without destroying it.
 *
 * Captures come off a Retina display — 3600×2338 is typical — and a plate in the
 * four-up grid is about 280 CSS pixels wide. That is a thirteenfold reduction,
 * and the browser's own scaler does it in one step. One step means the output
 * pixel is a near-point sample of the input, so a row of 9pt text turns into
 * aliased speckle: measured on a real recording, "APN / Username / Password"
 * came out as "APH / Ushrlarw / Fmravwe".
 *
 * Halving repeatedly fixes it, because each step averages a 2×2 block and no
 * detail is skipped over. The same frame then reads correctly. It is also
 * cheaper than the alternatives — 0.8ms against 1.7ms for `createImageBitmap`
 * with `resizeQuality: 'high'`, which in Chrome produces output no better than
 * the plain scaler.
 *
 * Canvases are not read back, only displayed, so a cross-origin frame tainting
 * the canvas costs nothing here and no CORS handshake is needed. */

/** The source rectangle that fills a `dw`×`dh` box without distortion — the
 * arithmetic behind `object-fit: cover`, which the canvas has no equivalent of. */
export function coverCrop(
  sourceW: number, sourceH: number, destW: number, destH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (!(sourceW > 0 && sourceH > 0 && destW > 0 && destH > 0)) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 };
  }
  const sourceRatio = sourceW / sourceH;
  const destRatio = destW / destH;
  if (sourceRatio > destRatio) {
    // Wider than the box: keep full height, trim the sides.
    const sw = sourceH * destRatio;
    return { sx: (sourceW - sw) / 2, sy: 0, sw, sh: sourceH };
  }
  const sh = sourceW / destRatio;
  return { sx: 0, sy: (sourceH - sh) / 2, sw: sourceW, sh };
}

/** How many halvings to take before the final draw.
 *
 * Stops while the intermediate is still at least the target size — halving past
 * it would throw away detail the last step wants, and the last step is then an
 * upscale of something already too small. */
export function halvingSteps(fromWidth: number, toWidth: number): number {
  if (!(fromWidth > 0 && toWidth > 0)) return 0;
  let steps = 0;
  let width = fromWidth;
  while (width / 2 > toWidth) {
    width /= 2;
    steps += 1;
  }
  return steps;
}

/** A canvas-like target, so a test can watch the draws without a canvas stack. */
export interface DrawTarget {
  width: number;
  height: number;
  getContext(id: '2d'): DrawContext | null;
}
export interface DrawContext {
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  drawImage(
    source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void;
}

/** Scratch canvases live here rather than per component.
 *
 * The intermediates are large — the first is a quarter of a 3600×2338 frame —
 * and one per card would be tens of megabytes across a full grid. Only one draw
 * runs at a time (each is synchronous, and only one card is ever hovered), so a
 * single shared pool is enough and its cost does not scale with the grid. */
const scratch: DrawTarget[] = [];

function scratchAt(index: number, make: () => DrawTarget): DrawTarget {
  while (scratch.length <= index) scratch.push(make());
  return scratch[index];
}

/** Releases the shared scratch canvases.
 *
 * Worth calling when nothing is animating: a zeroed canvas drops its backing
 * store, and holding several megabytes for a grid nobody is pointing at is
 * waste. They are recreated on the next draw. */
export function releaseScratch() {
  for (const canvas of scratch) {
    canvas.width = 0;
    canvas.height = 0;
  }
  scratch.length = 0;
}

export interface DownscaleOptions {
  /** Overridable so a test can supply a fake canvas. */
  createCanvas?: () => DrawTarget;
}

/** Paints `source` into `target`, cover-cropped and progressively halved.
 *
 * `target.width`/`height` are the destination in device pixels — set them from
 * the element's CSS size times `devicePixelRatio`, or the canvas is drawn at CSS
 * resolution and the halving buys nothing back on a Retina screen. */
export function drawCoverDownscaled(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  target: DrawTarget,
  { createCanvas }: DownscaleOptions = {},
): boolean {
  const destW = target.width;
  const destH = target.height;
  if (!(sourceW > 0 && sourceH > 0 && destW > 0 && destH > 0)) return false;

  const out = target.getContext('2d');
  if (!out) return false;
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = 'high';

  const { sx, sy, sw, sh } = coverCrop(sourceW, sourceH, destW, destH);
  const steps = halvingSteps(sw, destW);

  if (steps === 0) {
    // Already close to the target: one step is what the browser would do anyway,
    // and it is correct at this ratio.
    out.drawImage(source, sx, sy, sw, sh, 0, 0, destW, destH);
    return true;
  }

  const make = createCanvas
    ?? (() => document.createElement('canvas') as unknown as DrawTarget);

  // First halving reads straight from the source, so no full-size copy of a
  // 3600×2338 frame is ever allocated.
  let from: CanvasImageSource = source;
  let fromX = sx, fromY = sy, fromW = sw, fromH = sh;

  for (let i = 0; i < steps; i += 1) {
    const canvas = scratchAt(i, make);
    const w = Math.max(1, Math.round(fromW / 2));
    const h = Math.max(1, Math.round(fromH / 2));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(from, fromX, fromY, fromW, fromH, 0, 0, w, h);
    from = canvas as unknown as CanvasImageSource;
    fromX = 0; fromY = 0; fromW = w; fromH = h;
  }

  out.drawImage(from, fromX, fromY, fromW, fromH, 0, 0, destW, destH);
  return true;
}
