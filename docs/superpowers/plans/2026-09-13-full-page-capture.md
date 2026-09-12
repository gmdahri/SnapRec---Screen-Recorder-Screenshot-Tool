# Full-Page Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-page screenshots succeed at any page height and device pixel ratio, are never silently blank, and reach disk before anything can lose them.

**Architecture:** The content script keeps scrolling, sticky-element handling and overlap measurement, but stops holding the image. Each captured section goes background → offscreen document directly and is drawn into a pre-scaled canvas there; the result becomes a WebP `Blob` via `convertToBlob`, which removes base64 entirely and with it the 64 MiB IPC ceiling. A pixel budget computed before allocation replaces the ~115 MP cliff that silently produced blank images. Delivery reuses the disk-save, IndexedDB park and courier-iframe handoff already built and verified for recordings.

**Tech Stack:** Chrome MV3 (plain classic scripts, no build step), `OffscreenCanvas`, Vitest + jsdom in both workspaces, React 19 + TypeScript for the web app.

**Spec:** `docs/superpowers/specs/2026-09-13-full-page-capture-design.md`

## Global Constraints

- **The extension has no build step.** `background/*.js` are classic scripts loaded by `importScripts` into one shared global scope — not ES modules. New logic follows the established twin pattern: pure logic in `<name>.core.js` (ESM, imported only by tests) plus an identical `<name>.js` ending in a `globalThis` assignment, with a drift test. See `background/queue.core.js` / `background/queue.js` / `tests/queue.test.js`, or the newer `background/recording-file.core.js`.
- **`importScripts('config.js')` must stay first** in `background/background.js`.
- **`PIXEL_BUDGET = 80_000_000`.** Roughly 30% headroom under the ~115 MP ceiling measured in Chrome for Testing 145. It is a memory-dependent limit, not a constant — if blank captures are ever reported again, lower this rather than hunting a new root cause.
- **Output format is `image/webp` at quality `0.92`.** Measured 21.4 MB vs PNG's 84 MB at 2400×8000.
- **Preview thumbnail width is 480 CSS px.**
- **No `SNAPREC` message may carry more than 1 MB** (spec A3). Section images travel background → offscreen; they must never be routed through the content script.
- **Do not disturb the verified recording path.** `handoff/handoff.html` defaults to `kind=video` and must behave exactly as it does today when the parameter is absent.
- **The web app ships before the extension.** `Editor.tsx` must keep accepting the legacy `{ type: 'SNAPREC_EDIT_IMAGE', dataUrl }` shape indefinitely — extension rollout takes days.
- **Do not bump versions by hand.** Releases go through `./ship-to-store.sh`.
- Extension tests: `npm test --workspace=apps/extension`. Web tests: `npm test --workspace=apps/web`.

---

### Task 1: The capture geometry — pixel budget and stitch plan

The two pure calculations the feature turns on. Extracted first so the overlap
arithmetic, which today is validated only by eye, gets real tests.

**Files:**
- Create: `apps/extension/background/fullpage.core.js`
- Create: `apps/extension/background/fullpage.js`
- Test: `apps/extension/tests/fullpage.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces, on `globalThis.SnapRecFullPage` for the service worker and as named ESM exports for tests:
  - `PIXEL_BUDGET: number`
  - `budgetedScale({ pageW, pageH, dpr, budget? }) => number` — in `(0, 1]`
  - `stitchPlan({ scrollY, prevScrollY, viewportH, isFirst }) => { sourceYCss: number, drawHCss: number, destYCss: number } | null` — `null` means the section adds nothing and must be skipped
  - `canvasSize({ pageW, pageH, dpr, scale }) => { width: number, height: number }`
  - `thumbnailSize({ width, height, maxW? }) => { width: number, height: number }`

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/fullpage.test.js`:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PIXEL_BUDGET, budgetedScale, canvasSize, stitchPlan, thumbnailSize,
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
    const pageW = 2000, pageH = PIXEL_BUDGET / (2000 * 1 * 1) , dpr = 1;
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/extension -- fullpage
```

Expected: FAIL — `Failed to resolve import "../background/fullpage.core.js"`.

- [ ] **Step 3: Write the ESM core**

Create `apps/extension/background/fullpage.core.js`:

```js
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

/** Device pixels for the stitched canvas, never smaller than 1×1. */
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

export { PIXEL_BUDGET, budgetedScale, canvasSize, stitchPlan, thumbnailSize };
```

- [ ] **Step 4: Write the classic-script twin**

Create `apps/extension/background/fullpage.js` with **byte-identical bodies**,
the header paragraph adjusted, and the ESM export replaced by a global
assignment. Copy the file from Step 3 and change only:

- the closing sentence of the header comment to:
  `* This is the CLASSIC-SCRIPT copy that importScripts loads — importScripts`
  `* cannot load an ES module, so background/fullpage.core.js holds the`
  `* identical bodies for the tests. tests/fullpage.test.js fails if the two`
  `* drift. */`
- the final line from the `export { ... };` statement to:

```js
// Loaded by importScripts into the service worker's global scope.
globalThis.SnapRecFullPage = {
  PIXEL_BUDGET, budgetedScale, canvasSize, stitchPlan, thumbnailSize,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test --workspace=apps/extension -- fullpage
```

Expected: PASS, 19 tests. A failing drift test means the two files differ in
something other than comments and the export line — diff them.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/background/fullpage.core.js \
        apps/extension/background/fullpage.js \
        apps/extension/tests/fullpage.test.js
git commit -m "feat(extension): pixel budget and stitch geometry for full-page capture

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Stop the offscreen document from destroying a recording

Independent bug, fixed first because both region capture and the new full-page
path call `createOffscreenDocument()` and would otherwise end a recording in
progress. Spec D5, acceptance A5.

**Files:**
- Modify: `apps/extension/background/background.js:767-788` — `createOffscreenDocument`

**Interfaces:**
- Consumes: nothing. Produces: `createOffscreenDocument()` now reuses an open document instead of closing it.

- [ ] **Step 1: Replace the close-first behaviour**

In `apps/extension/background/background.js`, replace:

```js
async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        console.log('[SnapRec] Offscreen document already exists, closing it first');
        await closeOffscreenDocument();
    }

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }
```

with:

```js
/** One offscreen document, reused.
 *
 * This used to close any open document before creating a new one, which made
 * every screenshot a hazard: region capture opens an offscreen document to
 * crop in, so taking one during a recording closed the document holding the
 * recording and destroyed it. There is only ever one, and every caller wants
 * "make sure it exists", not "make me a fresh one".
 *
 * BLOBS is declared alongside the media reasons because full-page capture
 * stitches into a canvas there and encodes the result. */
async function createOffscreenDocument() {
    if (await hasOffscreenDocument()) return;

    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }
```

- [ ] **Step 2: Declare the BLOBS reason**

In the same function, replace:

```js
        reasons: [chrome.offscreen.Reason.DISPLAY_MEDIA, chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Recording screen/tab video and audio; microphone captured via getUserMedia'
```

with:

```js
        reasons: [
            chrome.offscreen.Reason.DISPLAY_MEDIA,
            chrome.offscreen.Reason.USER_MEDIA,
            chrome.offscreen.Reason.BLOBS,
        ],
        justification: 'Recording screen/tab video and audio; microphone captured via '
            + 'getUserMedia; stitching and encoding full-page screenshots'
```

- [ ] **Step 3: Check the syntax**

```bash
node --check apps/extension/background/background.js
```

Expected: no output.

- [ ] **Step 4: Verify in Chrome**

1. Load `apps/extension` unpacked at `chrome://extensions`.
2. Start a recording.
3. While it runs, take a **region** screenshot.
4. The recording must still be running — the in-page bar still counting, and
   `chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})` in the
   service worker console still returning one context.
5. Stop the recording. The file must appear in `Downloads/SnapRec/`.

- [ ] **Step 5: Run the extension suite**

```bash
npm test --workspace=apps/extension
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/background/background.js
git commit -m "fix(extension): reuse the offscreen document instead of closing it

Region capture opens an offscreen document to crop in. Because creation
closed any existing one first, taking a region screenshot during a
recording destroyed the recording.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Stitch and encode in the offscreen document

The heart of the change. After this task the offscreen document can assemble a
full-page capture from sections and hand back a Blob, with nothing large
crossing IPC.

**Files:**
- Modify: `apps/extension/offscreen/offscreen.js` — add three message cases and the stitching state
- Modify: `apps/extension/offscreen/offscreen.html` — load `fullpage.js`

**Interfaces:**
- Consumes: `SnapRecFullPage.canvasSize`, `SnapRecFullPage.thumbnailSize` from Task 1.
- Produces, as offscreen message actions:
  - `offscreen_fpBegin { pageW, pageH, dpr, scale }` → `{ success, width, height }`
  - `offscreen_fpSection { dataUrl, sourceYCss, drawHCss, destYCss, dpr, scale }` → `{ success }`
  - `offscreen_fpFinish {}` → `{ success, size, mimeType, thumbnail }` where `thumbnail` is a WebP data URL no wider than 480px
  - The finished image is left in `currentImageBlob` for Task 4 to deliver.

- [ ] **Step 1: Load the geometry helper into the offscreen document**

In `apps/extension/offscreen/offscreen.html`, add before the existing
`offscreen.js` script tag:

```html
<script src="../background/fullpage.js"></script>
```

- [ ] **Step 2: Add the stitching state and handlers**

In `apps/extension/offscreen/offscreen.js`, add near `let currentRecordingBlob = null;`:

```js
/** The full-page capture being assembled, and its finished Blob.
 *
 * Kept separate from currentRecordingBlob so a screenshot can never overwrite
 * a recording that has not been delivered yet. */
let fpCanvas = null;
let fpCtx = null;
let currentImageBlob = null;
```

Then add these three cases to the message switch, immediately after the
`offscreen_getBlobUrl` case:

```js
        case 'offscreen_fpBegin':
            try {
                const { width, height } = globalThis.SnapRecFullPage.canvasSize(message);
                fpCanvas = new OffscreenCanvas(width, height);
                fpCtx = fpCanvas.getContext('2d');
                // White, not transparent: a page with no background of its own
                // would otherwise encode as black once alpha is flattened.
                fpCtx.fillStyle = '#FFFFFF';
                fpCtx.fillRect(0, 0, width, height);
                currentImageBlob = null;
                console.log('[Offscreen] Full-page canvas', width, 'x', height);
                sendResponse({ success: true, width, height });
            } catch (e) {
                fpCanvas = null; fpCtx = null;
                sendResponse({ success: false, error: e.message });
            }
            return false;

        case 'offscreen_fpSection':
            drawFullPageSection(message)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'offscreen_fpFinish':
            finishFullPage()
                .then(r => sendResponse({ success: true, ...r }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
```

- [ ] **Step 3: Implement the two async helpers**

In `apps/extension/offscreen/offscreen.js`, add above `async function cropImage(`:

```js
/** Draws one scrolled section onto the full-page canvas.
 *
 * The section arrives as a data URL because that is what captureVisibleTab
 * returns, but it is a single viewport — around a megabyte — not the whole
 * page, so it crosses IPC comfortably. The whole point of this function's
 * existing here is that the assembled result never does. */
async function drawFullPageSection({ dataUrl, sourceYCss, drawHCss, destYCss, dpr, scale }) {
    if (!fpCtx) throw new Error('No full-page capture in progress');

    const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
    try {
        // captureVisibleTab returns device pixels, so the image is already
        // dpr-scaled; only the budget scale still has to be applied.
        const srcY = Math.round(sourceYCss * dpr);
        const srcH = Math.round(drawHCss * dpr);
        const dstY = Math.round(destYCss * dpr * scale);
        const dstH = Math.round(drawHCss * dpr * scale);
        const dstW = Math.round(bitmap.width * scale);

        fpCtx.drawImage(bitmap, 0, srcY, bitmap.width, srcH, 0, dstY, dstW, dstH);
    } finally {
        bitmap.close();
    }
}

/** Encodes the assembled canvas and returns a preview-sized copy with it.
 *
 * convertToBlob rather than toDataURL: no base64, so no 33% inflation and no
 * 64 MiB message ceiling. The thumbnail is what the in-page mini preview
 * displays — it used to be handed the full-size image for a card-sized slot. */
async function finishFullPage() {
    if (!fpCanvas) throw new Error('No full-page capture in progress');

    const blob = await fpCanvas.convertToBlob({ type: 'image/webp', quality: 0.92 });
    if (!blob || blob.size === 0) throw new Error('Encoding produced no image');
    currentImageBlob = blob;

    const t = globalThis.SnapRecFullPage.thumbnailSize({
        width: fpCanvas.width, height: fpCanvas.height,
    });
    const thumbCanvas = new OffscreenCanvas(t.width, t.height);
    thumbCanvas.getContext('2d').drawImage(fpCanvas, 0, 0, t.width, t.height);
    const thumbBlob = await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
    const thumbnail = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(thumbBlob);
    });

    // Release the big canvas as soon as the bytes are safe.
    fpCanvas = null; fpCtx = null;

    console.log('[Offscreen] Full-page encoded,', blob.size, 'bytes');
    return { size: blob.size, mimeType: blob.type || 'image/webp', thumbnail };
}
```

- [ ] **Step 4: Check the syntax**

```bash
node --check apps/extension/offscreen/offscreen.js
```

Expected: no output.

- [ ] **Step 5: Verify the encoder directly in Chrome**

This is canvas work that unit tests in jsdom cannot exercise — jsdom has no
`OffscreenCanvas` and no WebP encoder. Verify it against the real one:

1. Load the extension unpacked.
2. Open the service worker console and run:

```js
await createOffscreenDocument();
await chrome.runtime.sendMessage({ action: 'offscreen_fpBegin',
  pageW: 1200, pageH: 4000, dpr: 2, scale: 1 });
```

Expected: `{success: true, width: 2400, height: 8000}`.

3. Then:

```js
const d = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
await chrome.runtime.sendMessage({ action: 'offscreen_fpSection',
  dataUrl: d, sourceYCss: 0, drawHCss: 800, destYCss: 0, dpr: 2, scale: 1 });
const r = await chrome.runtime.sendMessage({ action: 'offscreen_fpFinish' });
console.log(r.size, r.mimeType, r.thumbnail.length);
```

Expected: a non-zero `size`, `mimeType` of `image/webp`, and a `thumbnail`
under about 60,000 characters.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/offscreen/offscreen.js apps/extension/offscreen/offscreen.html
git commit -m "feat(extension): stitch and encode full-page captures offscreen

convertToBlob rather than toDataURL, so the assembled image never
becomes a base64 string and never meets the 64MiB message ceiling.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Drive the capture from background and content script

Replaces the content script's stitching with a stream of geometry messages, and
routes section images straight from `captureVisibleTab` into the offscreen
document.

**Files:**
- Modify: `apps/extension/background/background.js:1-10` — add the `importScripts` line
- Modify: `apps/extension/background/background.js` — add `fullPageBegin`/`fullPageSection`/`fullPageFinish` message cases and handlers
- Modify: `apps/extension/content/content.js:246-447` — rewrite `captureFullPage`

**Interfaces:**
- Consumes: `SnapRecFullPage.budgetedScale` (Task 1); `offscreen_fpBegin` / `offscreen_fpSection` / `offscreen_fpFinish` (Task 3).
- Produces, as background message actions the content script calls:
  - `fullPageBegin { pageW, pageH, viewportH, dpr }` → `{ success, scale, width, height }`
  - `fullPageSection { sourceYCss, drawHCss, destYCss }` → `{ success }`
  - `fullPageFinish {}` → `{ success, thumbnail, scale, size }`

- [ ] **Step 1: Load the geometry helper into the service worker**

In `apps/extension/background/background.js`, add after the `recording-file.js` line:

```js
importScripts('fullpage.js');
```

- [ ] **Step 2: Add the background handlers**

In `apps/extension/background/background.js`, add above `async function processScreenshot(`:

```js
/** State for the full-page capture in flight.
 *
 * The scale is decided once, at begin, and every section is drawn with it —
 * recomputing per section would make the seams disagree. */
let fullPageState = null;

/** Starts a full-page capture and answers with the scale that will be applied.
 *
 * A page can be larger than the browser will encode: past roughly 115
 * megapixels the canvas silently yields nothing. budgetedScale decides how far
 * to shrink so that never happens, and the content script reports it so a
 * downscaled capture is stated rather than passed off as full resolution. */
async function fullPageBegin({ pageW, pageH, viewportH, dpr }) {
    const scale = SnapRecFullPage.budgetedScale({ pageW, pageH, dpr });
    await createOffscreenDocument();

    const r = await chrome.runtime.sendMessage({
        action: 'offscreen_fpBegin', pageW, pageH, dpr, scale,
    });
    if (!r?.success) throw new Error(r?.error ?? 'could not start full-page capture');

    fullPageState = { dpr, scale, viewportH, sections: 0 };
    return { scale, width: r.width, height: r.height };
}

/** Captures the current viewport and forwards it straight to the offscreen
 * document. The image never travels back through the content script — that
 * round trip is what used to build a multi-hundred-megabyte string in the page. */
async function fullPageSection({ sourceYCss, drawHCss, destYCss }, windowId) {
    if (!fullPageState) throw new Error('No full-page capture in progress');

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? null, { format: 'png' });
    const r = await chrome.runtime.sendMessage({
        action: 'offscreen_fpSection',
        dataUrl, sourceYCss, drawHCss, destYCss,
        dpr: fullPageState.dpr, scale: fullPageState.scale,
    });
    if (!r?.success) throw new Error(r?.error ?? 'section draw failed');
    fullPageState.sections += 1;
}

/** Finishes the capture: encode, save to disk, park for the editor, and hand
 * the content script a thumbnail for its preview. */
async function fullPageFinish() {
    if (!fullPageState) throw new Error('No full-page capture in progress');
    const { scale, sections } = fullPageState;
    fullPageState = null;

    const done = await chrome.runtime.sendMessage({ action: 'offscreen_fpFinish' });
    if (!done?.success) throw new Error(done?.error ?? 'encoding failed');

    console.log('[SnapRec] Full-page capture:', sections, 'sections,',
        done.size, 'bytes, scale', scale);
    Analytics.track('screenshot_taken', {
        capture_type: 'fullpage',
        file_size_mb: Math.round((done.size / (1024 * 1024)) * 100) / 100,
    });

    await saveImageToDisk();
    await deliverImageToEditor();

    return { thumbnail: done.thumbnail, scale, size: done.size };
}
```

- [ ] **Step 3: Route the three actions**

In the `switch (message.action)` block in `apps/extension/background/background.js`,
add these cases immediately after `case 'captureFullPage':`. They need async
responses, so each returns `true`:

```js
        case 'fullPageBegin':
            fullPageBegin(message)
                .then(r => sendResponse({ success: true, ...r }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
        case 'fullPageSection':
            fullPageSection(message, sender.tab?.windowId)
                .then(() => sendResponse({ success: true }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
        case 'fullPageFinish':
            fullPageFinish()
                .then(r => sendResponse({ success: true, ...r }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;
```

- [ ] **Step 4: Rewrite the content script's capture loop**

In `apps/extension/content/content.js`, replace the whole body of
`async function captureFullPage()` (from `console.log('=== Starting full page capture ===');`
to the closing brace of its `finally` block) with:

```js
        console.log('=== Starting full page capture ===');
        showLoadingIndicator('Preparing capture...');

        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;

        try {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const totalHeight = document.documentElement.scrollHeight;
            const dpr = window.devicePixelRatio || 1;

            const begun = await chrome.runtime.sendMessage({
                action: 'fullPageBegin',
                pageW: viewportWidth, pageH: totalHeight, viewportH: viewportHeight, dpr,
            });
            if (!begun?.success) throw new Error(begun?.error ?? 'could not start capture');

            window.scrollTo(0, 0);
            await sleep(500);

            const numCaptures = Math.ceil(totalHeight / viewportHeight);
            let prevScrollY = null;

            for (let i = 0; i < numCaptures; i++) {
                updateLoadingIndicator(`Capturing section ${i + 1}/${numCaptures}...`);
                window.scrollTo(0, i * viewportHeight);
                await sleep(600);

                const scrollY = window.scrollY;
                const plan = window.SnapRecFullPage.stitchPlan({
                    scrollY, prevScrollY, viewportH: viewportHeight, isFirst: i === 0,
                });

                if (plan) {
                    hideLoadingIndicator();
                    if (i > 0) toggleStickyElements(true);
                    await sleep(400);

                    const sent = await chrome.runtime.sendMessage({
                        action: 'fullPageSection', ...plan,
                    });

                    if (i > 0) toggleStickyElements(false);
                    showLoadingIndicator(`Processing section ${i + 1}/${numCaptures}...`);
                    if (!sent?.success) throw new Error(sent?.error ?? `section ${i + 1} failed`);
                    prevScrollY = scrollY;
                }

                if (scrollY + viewportHeight >= totalHeight - 5) break;
            }

            updateLoadingIndicator('Finishing...');
            const done = await chrome.runtime.sendMessage({ action: 'fullPageFinish' });
            if (!done?.success) throw new Error(done?.error ?? 'could not finish capture');

            // A downscaled capture is stated, never passed off as full size.
            if (done.scale < 0.999) {
                console.log(`Page too large for full resolution; captured at ${Math.round(done.scale * 100)}%`);
            }
            showMiniPreview(done.thumbnail);

        } catch (error) {
            console.error('Error capturing full page:', error);
            alert('Failed to capture full page: ' + error.message);
        } finally {
            window.scrollTo(originalScrollX, originalScrollY);
            hideLoadingIndicator();
        }
```

- [ ] **Step 5: Make the geometry helper available to the content script**

`stitchPlan` runs in the page, so `fullpage.js` must be injected alongside
`content.js`. In `apps/extension/manifest.json`, add to the `resources` array of
the first `web_accessible_resources` block, after `"handoff/handoff.js",`:

```json
                "background/fullpage.js",
```

Then in `apps/extension/background/utils/contentScriptManager.js`, add it to
the `jsFiles` default. The files are injected in array order, so it must come
**before** `content/content.js`, which reads the global. This mirrors how
`content/webcam.js` already supplies `globalThis.SnapRecWebcam`. Replace:

```js
            jsFiles = ['content/webcam.js', 'content/content.js'],
```

with:

```js
            // fullpage.js before content.js: it defines globalThis.SnapRecFullPage,
            // which content.js reads for the stitch geometry.
            jsFiles = ['content/webcam.js', 'background/fullpage.js', 'content/content.js'],
```

- [ ] **Step 6: Check the syntax**

```bash
node --check apps/extension/background/background.js
node --check apps/extension/content/content.js
python3 -c "import json; json.load(open('apps/extension/manifest.json')); print('manifest ok')"
```

Expected: `manifest ok` and no other output.

- [ ] **Step 7: Run the extension suite**

```bash
npm test --workspace=apps/extension
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/extension/background/background.js apps/extension/content/content.js \
        apps/extension/manifest.json apps/extension/background/utils/contentScriptManager.js
git commit -m "feat(extension): stream full-page sections straight to the offscreen canvas

The content script no longer holds the assembled image. Section captures
go background -> offscreen directly; only geometry crosses IPC.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Save the image to disk and park it for the editor

Generalises the recording delivery path so a screenshot rides the same rails.
Spec D4, acceptance A4.

**Files:**
- Modify: `apps/extension/background/recording-file.core.js` — extend the extension map
- Modify: `apps/extension/background/recording-file.js` — the twin
- Modify: `apps/extension/tests/recordingFile.test.js` — add cases
- Modify: `apps/extension/offscreen/offscreen.js` — teach `offscreen_getBlobUrl` and `persistForHandoff` about images
- Modify: `apps/extension/background/background.js` — add `saveImageToDisk` and `deliverImageToEditor`
- Modify: `apps/extension/handoff/handoff.js` — add the `kind` parameter

**Interfaces:**
- Consumes: `currentImageBlob` in the offscreen document (Task 3); `fullPageFinish` calls these (Task 4). Also `DISK_SAVE_TIMEOUT_MS`, `SnapRecFile.recordingFilename`, `SnapRecFile.downloadStarted` and `SnapRecFile.downloadSettled` — all already present in `background/background.js` and `background/recording-file.js` from the recording-durability work; this task does not define them.
- Produces: `saveImageToDisk() => Promise<{filename, bytes, mimeType}|null>`, `deliverImageToEditor() => Promise<void>`.

- [ ] **Step 1: Write the failing test for image filenames**

In `apps/extension/tests/recordingFile.test.js`, add inside the
`describe('disk copy naming', ...)` block:

```js
  it('names a WebP screenshot with a webp extension', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'image/webp'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.webp');
  });

  it('names a PNG screenshot with a png extension', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'image/png'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.png');
  });

  it('still treats an unrecognised type as webm, the recorder default', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'application/octet-stream'))
      .toMatch(/\.webm$/);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/extension -- recordingFile
```

Expected: FAIL — the WebP case returns `.webm`.

- [ ] **Step 3: Extend the extension map in both twins**

In **both** `apps/extension/background/recording-file.core.js` and
`apps/extension/background/recording-file.js`, replace:

```js
  const ext = /mp4/i.test(mimeType) ? 'mp4' : 'webm';
```

with:

```js
  // Screenshots share this naming, so the table covers images too. Anything
  // unrecognised falls back to webm, which is what the recorder produces.
  const ext = /webp/i.test(mimeType) ? 'webp'
    : /png/i.test(mimeType) ? 'png'
    : /jpe?g/i.test(mimeType) ? 'jpg'
    : /mp4/i.test(mimeType) ? 'mp4'
    : 'webm';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test --workspace=apps/extension -- recordingFile
```

Expected: PASS, 18 tests, drift test included.

- [ ] **Step 5: Teach the offscreen document about the image blob**

In `apps/extension/offscreen/offscreen.js`, replace the `offscreen_getBlobUrl`
case body with a version that selects the blob by kind:

```js
        case 'offscreen_getBlobUrl': {
            const blob = message.kind === 'image' ? currentImageBlob : currentRecordingBlob;
            if (!blob) {
                sendResponse({ success: false, error: 'No capture available' });
            } else {
                sendResponse({
                    success: true,
                    url: URL.createObjectURL(blob),
                    size: blob.size,
                    mimeType: blob.type || (message.kind === 'image' ? 'image/webp' : 'video/webm'),
                });
            }
            return false;
        }
```

Then replace the body of `persistForHandoff` so it parks images under their own
keys, leaving the recording keys exactly as they are:

```js
async function persistForHandoff(id, metadataStr, kind = 'video') {
    const blob = kind === 'image' ? currentImageBlob : currentRecordingBlob;
    if (!blob) throw new Error('No capture available');

    // Images and recordings use separate keys so a screenshot can never
    // overwrite a recording that has not reached the share page yet.
    const blobKey = kind === 'image' ? 'latest_image_blob' : 'latest_video_blob';
    const idKey = kind === 'image' ? 'latest_image_id' : 'latest_id';
    const metaKey = kind === 'image' ? 'latest_image_meta' : 'latest_metadata';
    const tsKey = kind === 'image' ? 'latest_image_timestamp' : 'latest_video_timestamp';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnapRecDB', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings');
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            store.put(blob, blobKey);
            store.put(id, idKey);
            store.put(metadataStr, metaKey);
            store.put(Date.now(), tsKey);

            transaction.oncomplete = () => {
                console.log('[Offscreen] Capture parked for handoff,', kind, blob.size);
                resolve({ size: blob.size, type: blob.type });
            };
            transaction.onerror = () => reject(new Error('Failed to park capture for handoff'));
        };

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
}
```

Note the removed `store.clear()`: it would wipe a parked recording whenever a
screenshot was taken. Update the case to pass the kind through:

```js
        case 'offscreen_persistForHandoff':
            persistForHandoff(message.id, message.metadataStr, message.kind)
                .then(result => sendResponse({ success: true, size: result.size, type: result.type }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
```

- [ ] **Step 6: Add the kind parameter to the courier**

In `apps/extension/handoff/handoff.js`, replace:

```js
const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
```

with:

```js
const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
/* Defaults to video so the recording handoff, which sends no kind, behaves
 * exactly as before. */
const kind = params.get('kind') === 'image' ? 'image' : 'video';
const KEYS = kind === 'image'
    ? { blob: 'latest_image_blob', meta: 'latest_image_meta', type: 'SNAPREC_EDIT_IMAGE' }
    : { blob: 'latest_video_blob', meta: 'latest_metadata', type: 'SNAPREC_VIDEO_DATA' };
```

Then replace `store.get('latest_video_blob')` with `store.get(KEYS.blob)`,
`store.get('latest_metadata')` with `store.get(KEYS.meta)`, and in the final
`parent.postMessage` call replace `type: 'SNAPREC_VIDEO_DATA'` with
`type: KEYS.type`.

- [ ] **Step 7: Add the two background delivery functions**

In `apps/extension/background/background.js`, add directly below `saveRecordingToDisk`:

```js
/** The screenshot's disk copy, on the same terms as a recording's.
 *
 * Shares saveRecordingToDisk's contract: the blob: URL belongs to the offscreen
 * document, so the write is awaited rather than merely started. */
async function saveImageToDisk() {
    const info = await chrome.runtime
        .sendMessage({ action: 'offscreen_getBlobUrl', kind: 'image' })
        .catch((e) => ({ success: false, error: e.message }));
    if (!info?.success) {
        console.error('[SnapRec] No image to save to disk:', info?.error);
        return null;
    }

    const filename = SnapRecFile.recordingFilename(new Date(), info.mimeType);
    const started = await new Promise((resolve) => {
        chrome.downloads.download({ url: info.url, filename, saveAs: false }, (downloadId) => {
            resolve(SnapRecFile.downloadStarted(downloadId, chrome.runtime.lastError?.message));
        });
    });
    if (!started.ok) {
        console.error('[SnapRec] Screenshot download refused:', started.reason);
        return null;
    }

    const settled = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve({ ok: false, reason: 'timeout' });
        }, DISK_SAVE_TIMEOUT_MS);
        const onChanged = (delta) => {
            const outcome = SnapRecFile.downloadSettled(delta, started.downloadId);
            if (!outcome) return;
            clearTimeout(timer);
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve(outcome);
        };
        chrome.downloads.onChanged.addListener(onChanged);
    });
    if (!settled.ok) {
        console.error('[SnapRec] Screenshot download failed:', settled.reason);
        return null;
    }

    console.log('[SnapRec] Screenshot saved to disk:', filename, info.size, 'bytes');
    return { filename, bytes: info.size, mimeType: info.mimeType };
}

/** Parks the image and opens the editor on it.
 *
 * The courier carries the Blob by reference, so this costs the same for a
 * 16,000px page as for a short one. */
async function deliverImageToEditor() {
    const imageId = crypto.randomUUID();
    const parked = await chrome.runtime.sendMessage({
        action: 'offscreen_persistForHandoff', id: imageId, metadataStr: '[]', kind: 'image',
    }).catch((e) => ({ success: false, error: e.message }));

    if (!parked?.success) {
        console.error('[SnapRec] Could not park screenshot:', parked?.error);
        return;
    }

    const tab = await chrome.tabs.create({ url: `${CONFIG.WEB_BASE_URL}/editor` });
    const frameUrl = chrome.runtime.getURL(
        `handoff/handoff.html?kind=image&id=${encodeURIComponent(imageId)}`);

    const listener = async (tabId, info) => {
        if (tabId !== tab.id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (src) => {
                    const frame = document.createElement('iframe');
                    frame.src = src;
                    frame.setAttribute('aria-hidden', 'true');
                    frame.style.cssText =
                        'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
                    document.documentElement.appendChild(frame);
                },
                args: [frameUrl],
            });
        } catch (err) {
            console.error('[SnapRec] Could not inject image handoff frame:', err.message);
        }
    };
    chrome.tabs.onUpdated.addListener(listener);
}
```

- [ ] **Step 8: Check the syntax and run the suite**

```bash
node --check apps/extension/background/background.js
node --check apps/extension/offscreen/offscreen.js
node --check apps/extension/handoff/handoff.js
npm test --workspace=apps/extension
```

Expected: PASS, no other output.

- [ ] **Step 9: Verify the recording path is untouched**

The courier and `persistForHandoff` were both changed, so re-run the recording
acceptance test before moving on:

1. Load the extension unpacked.
2. Record for two minutes and stop.
3. The file must appear in `Downloads/SnapRec/*.webm` and `/v` must play it.
4. Refresh `/v`; it must still play.

- [ ] **Step 10: Commit**

```bash
git add apps/extension/background/recording-file.core.js \
        apps/extension/background/recording-file.js \
        apps/extension/tests/recordingFile.test.js \
        apps/extension/offscreen/offscreen.js \
        apps/extension/handoff/handoff.js \
        apps/extension/background/background.js
git commit -m "feat(extension): deliver full-page captures to disk and the editor

Reuses the recording delivery path: disk copy first, then a by-reference
handoff through the courier frame. Images use their own IndexedDB keys so
a screenshot can never overwrite an undelivered recording.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Teach the web editor to accept a Blob

Ships **before** the extension. Spec D6, acceptance A6 and A7.

**Files:**
- Modify: `apps/web/src/lib/handoffMessage.ts` — add the `image` kind
- Modify: `apps/web/src/__tests__/handoffMessage.test.ts` — add cases
- Modify: `apps/web/src/pages/Editor.tsx:32-51` — the message listener and session fallback

**Interfaces:**
- Consumes: nothing.
- Produces: `readHandoffMessage` also returns `{ kind: 'image'; blob: Blob; id?: string }` for `SNAPREC_EDIT_IMAGE` messages carrying a Blob, and `{ kind: 'imageDataUrl'; dataUrl: string; id?: string }` for the legacy shape.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/__tests__/handoffMessage.test.ts`, add a new `describe` block:

```ts
describe('readHandoffMessage — screenshots', () => {
  it('accepts an image Blob from the extension iframe', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_EDIT_IMAGE', blob, id: 'i1' }, SELF))
      .toEqual({ kind: 'image', blob, id: 'i1' });
  });

  it('accepts the legacy data URL an older extension injects', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_EDIT_IMAGE', dataUrl: 'data:image/png;base64,AA' }, SELF))
      .toEqual({ kind: 'imageDataUrl', dataUrl: 'data:image/png;base64,AA', id: undefined });
  });

  it('rejects an image from a cross-origin frame', () => {
    const blob = new Blob(['x'], { type: 'image/webp' });
    expect(readHandoffMessage('https://evil.example', { type: 'SNAPREC_EDIT_IMAGE', blob }, SELF))
      .toBeNull();
  });

  it('ignores an image message carrying nothing', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_EDIT_IMAGE', id: 'i1' }, SELF)).toBeNull();
  });

  it('keeps video and image messages distinct', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob }, SELF)?.kind).toBe('blob');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/web -- handoffMessage
```

Expected: FAIL — `SNAPREC_EDIT_IMAGE` currently returns null.

- [ ] **Step 3: Extend the reader**

In `apps/web/src/lib/handoffMessage.ts`, extend the payload union:

```ts
export type HandoffPayload =
    | { kind: 'blob'; blob: Blob; id?: string; metadataStr?: string }
    | { kind: 'idb'; id?: string }
    | { kind: 'dataUrl'; dataUrl: string; id?: string }
    | { kind: 'image'; blob: Blob; id?: string }
    | { kind: 'imageDataUrl'; dataUrl: string; id?: string };
```

and add this branch immediately after the `if (msg.type !== 'SNAPREC_VIDEO_DATA')`
guard is replaced. Replace:

```ts
    if (msg.type !== 'SNAPREC_VIDEO_DATA') return null;

    const id = typeof msg.id === 'string' ? msg.id : undefined;
```

with:

```ts
    const isVideo = msg.type === 'SNAPREC_VIDEO_DATA';
    const isImage = msg.type === 'SNAPREC_EDIT_IMAGE';
    if (!isVideo && !isImage) return null;

    const id = typeof msg.id === 'string' ? msg.id : undefined;

    if (isImage) {
        if (msg.blob instanceof Blob) return { kind: 'image', blob: msg.blob, id };
        if (typeof msg.dataUrl === 'string' && msg.dataUrl) {
            return { kind: 'imageDataUrl', dataUrl: msg.dataUrl, id };
        }
        return null;
    }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/web -- handoffMessage
```

Expected: PASS.

- [ ] **Step 5: Use it in the editor**

In `apps/web/src/pages/Editor.tsx`, add to the imports:

```ts
import { readHandoffMessage } from '../lib/handoffMessage';
```

Then replace the whole `useEffect` that begins
`// 1. Check if there's an image in sessionStorage (from extension injection)`
with:

```ts
    useEffect(() => {
        /** A blob: URL dies with the document, so sessionStorage cannot carry a
         * screenshot across a refresh the way a data URL did. The image is kept
         * in this origin's IndexedDB instead, and read back on mount. */
        const IMAGE_KEY = 'snaprec_editor_image_blob';

        const loadStoredBlob = (): Promise<Blob | null> => new Promise((resolve) => {
            try {
                const rq = indexedDB.open('SnapRecDB', 2);
                rq.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
                };
                rq.onsuccess = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) return resolve(null);
                    const g = db.transaction(['recordings'], 'readonly').objectStore('recordings').get(IMAGE_KEY);
                    g.onsuccess = () => resolve(g.result instanceof Blob ? g.result : null);
                    g.onerror = () => resolve(null);
                };
                rq.onerror = () => resolve(null);
            } catch { resolve(null); }
        });

        const storeBlob = (blob: Blob) => {
            try {
                const rq = indexedDB.open('SnapRecDB', 2);
                rq.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
                };
                rq.onsuccess = (e: any) => {
                    const db = e.target.result;
                    db.transaction(['recordings'], 'readwrite').objectStore('recordings').put(blob, IMAGE_KEY);
                };
            } catch { /* storage unavailable */ }
        };

        const savedImage = sessionStorage.getItem('snaprec_editing_image');
        if (savedImage) {
            console.log('Editor: Found image in sessionStorage');
            setCapturedImage(savedImage);
        } else {
            void loadStoredBlob().then((blob) => {
                if (blob) {
                    console.log('Editor: Restored image from IndexedDB,', blob.size, 'bytes');
                    setCapturedImage(URL.createObjectURL(blob));
                }
            });
        }

        const handleMessage = (event: MessageEvent) => {
            const payload = readHandoffMessage(event.origin, event.data, window.location.origin);
            if (!payload) return;

            if (payload.kind === 'image') {
                console.log('Editor: Received image blob,', payload.blob.size, 'bytes');
                setCapturedImage(URL.createObjectURL(payload.blob));
                storeBlob(payload.blob);
            } else if (payload.kind === 'imageDataUrl') {
                console.log('Editor: Received SNAPREC_EDIT_IMAGE (legacy data URL)');
                setCapturedImage(payload.dataUrl);
                try {
                    sessionStorage.setItem('snaprec_editing_image', payload.dataUrl);
                } catch { /* quota */ }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setCapturedImage]);
```

- [ ] **Step 6: Run the web suite and typecheck**

```bash
npm test --workspace=apps/web
npm run build --workspace=apps/web
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/handoffMessage.ts \
        apps/web/src/__tests__/handoffMessage.test.ts \
        apps/web/src/pages/Editor.tsx
git commit -m "feat(web): accept a by-reference image Blob in the editor

Also applies the origin check to SNAPREC_EDIT_IMAGE, which previously
accepted an image from any origin.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Deploy the web app before starting Task 7**

Task 4 and Task 5 make the extension send the new shape. The web app must be
live at `https://www.snaprecorder.org` first.

---

### Task 7: Browser acceptance run

The unit tests cover the arithmetic; jsdom has no `OffscreenCanvas` and no WebP
encoder, so the feature itself is verified against real Chrome. Every
acceptance criterion in the spec is checked here.

**Files:**
- No source changes. This task is verification.

**Interfaces:**
- Consumes: everything from Tasks 1–6.

- [ ] **Step 1: Build the test pages**

```bash
mkdir -p /tmp/snaprec-fp/site
python3 - <<'PY'
import io, random
random.seed(7)
for name, blocks in (('short.html', 50), ('tall.html', 200), ('huge.html', 400)):
    rows = []
    for i in range(blocks):
        cells = "".join(
            f'<i style="background:rgb({random.randrange(256)},{random.randrange(256)},{random.randrange(256)})"></i>'
            for _ in range(120))
        rows.append(f'<div class=r>{cells}</div>')
    io.open(f'/tmp/snaprec-fp/site/{name}', 'w').write(
        "<!doctype html><meta charset=utf-8><title>" + name + "</title>"
        "<style>body{margin:0}.r{height:80px;display:flex}.r i{flex:1;display:block}</style>"
        + "".join(rows))
print("short=4000px tall=16000px huge=32000px")
PY
cd /tmp/snaprec-fp/site && python3 -m http.server 8899
```

High-entropy blocks, so the encoder cannot compress the page away — that is
what made the original bug reproduce.

- [ ] **Step 2: Point the extension at a local web app**

In `apps/extension/background/config.js`, swap to the commented-out localhost
lines, and start the web app:

```bash
npm run dev --workspace=apps/web
```

**Restore `config.js` with `git checkout apps/extension/background/config.js`
when this task is finished.**

- [ ] **Step 3: Check each acceptance criterion**

Load the extension unpacked, then for each page take a full-page screenshot and
record the result:

| Page | Check | Expected |
|---|---|---|
| `short.html` (4,000px) | **A1** — the case that fails today | capture completes, no alert |
| `tall.html` (16,000px) | full resolution retained | `scale` logged as 1 |
| `huge.html` (32,000px) | **A2** — no blank image | completes, `scale` under 1, image is not blank |
| any | **A3** — no huge messages | no "exceeded maximum allowed size" anywhere |
| any | **A4** — disk copy | `Downloads/SnapRec/*.webp` exists and opens |
| any | **A7** — refresh | reload `/editor`; the canvas still shows the image |

- [ ] **Step 4: Check A5 — a screenshot must not kill a recording**

1. Start a recording.
2. While it runs, take a full-page screenshot.
3. The recording must still be running.
4. Stop it; the `.webm` must appear in `Downloads/SnapRec/`.

- [ ] **Step 5: Check A6 — backwards compatibility**

With the **previous** extension release loaded (`git stash` the extension
changes, or load the last shipped zip) against the **updated** local web app,
take a visible-area screenshot and click Edit. The editor must still receive the
image through the legacy data-URL path.

- [ ] **Step 6: Restore config and clean up**

```bash
git checkout apps/extension/background/config.js
rm -rf /tmp/snaprec-fp
```

Confirm `config.js` shows the production URLs uncommented before committing
anything else.

- [ ] **Step 7: Record the results**

Append a short results table to
`docs/superpowers/specs/2026-09-13-full-page-capture-design.md` under a new
`## Verification` heading, naming the Chrome version, the device pixel ratio,
and the measured scale and file size for each page. Commit:

```bash
git add docs/superpowers/specs/2026-09-13-full-page-capture-design.md
git commit -m "docs: record full-page capture acceptance results

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Release

- [ ] Confirm the web app is deployed (Task 6, Step 8) **before** the extension ships.
- [ ] `./ship-to-store.sh` from `apps/extension` — do not hand-edit versions.
- [ ] After the new version is live on the Chrome Web Store, bump
      `apps/web/public/version.json` to match and deploy the web app.

## Known limits carried forward

Scroll-and-stitch cannot capture what the page does not render while scrolling.
Lazy-loaded images below the fold, infinite scroll, video backgrounds and
scroll-linked animations will still produce artefacts on some sites. Only
`chrome.debugger` with `Page.captureScreenshot({captureBeyondViewport: true})`
fixes those, and it was rejected for the permission banner it forces on every
capture. If those artefacts become the top complaint, that trade-off is the one
to revisit.
