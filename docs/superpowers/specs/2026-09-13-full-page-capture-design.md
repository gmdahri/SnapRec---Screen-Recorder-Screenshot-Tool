# Design: Full-Page Screenshot Capture

**Status:** approved
**Date:** 2026-09-13
**Supersedes:** the scroll-and-stitch implementation in `apps/extension/content/content.js:246-447`

## Problem

Full-page capture fails on ordinary pages. Two independent defects, both measured
in Chrome for Testing 145 at `devicePixelRatio: 2`, 1200px viewport.

### Defect 1 — the stitched image exceeds the IPC message limit

`content/content.js:434` sends the whole stitched PNG as a base64 data URL
through `chrome.runtime.sendMessage`, which has a hard **64 MiB** ceiling.

| Page height | Canvas | PNG data URL | Over 64 MiB |
|---|---|---|---|
| **4,000 px** | 2400×8000 | **84 MB** | **yes** |
| 8,000 px | 2400×16000 | 168 MB | yes |
| 16,000 px | 2400×32000 | 336 MB | yes |

A 4,000px page — roughly five screens — already fails. The user-visible symptom
is the alert raised by the catch at `content.js:440`:

> Failed to capture full page: Error in invocation of runtime.sendMessage(...):
> Message exceeded maximum allowed size of 64MiB.

Two things compound it. `devicePixelRatio: 2` quadruples the pixel count, and
the format is lossless PNG — note that the quality argument in
`canvas.toDataURL('image/png', 0.95)` is **silently ignored for PNG**, so the
code reads as though it compresses when it does not.

### Defect 2 — very tall pages produce a blank image, silently

Above roughly **115 megapixels**, `toDataURL` returns an empty string rather
than throwing:

| Canvas | Megapixels | `toDataURL` |
|---|---|---|
| 2400×48000 | 115 MP | ok |
| **2400×64000** | **154 MP** | **empty** |

A 32,000px page at dpr 2 lands exactly there. The message then sends
*successfully* carrying nothing, so the user gets a blank screenshot with no
error at all. This is worse than Defect 1 because nothing reports it.

The measured ceiling is almost certainly memory-dependent rather than a fixed
constant, so any budget needs headroom.

## Goals

- **G1.** Full-page capture succeeds on pages of any height, at any device pixel
  ratio, with no size-dependent failure.
- **G2.** No capture is ever silently blank. A page too large for full
  resolution is downscaled and the user is told, never dropped.
- **G3.** A finished full-page capture reaches disk before anything that can
  lose it, as recordings now do.
- **G4.** No new extension permissions.

## Non-goals

- Fidelity problems inherent to scroll-and-stitch: lazy-loaded images, infinite
  scroll, video backgrounds, scroll-linked animations. Only `chrome.debugger`
  with `Page.captureScreenshot({captureBeyondViewport: true})` fixes those, and
  it was rejected — it shows a persistent "started debugging this browser"
  banner, fails while DevTools is open, and draws extra Web Store review.
- Changing visible-area or region capture, which are verified working.
- A user-facing quality setting.

## Design

### D1 — Stitch in the offscreen document, not the page

The content script keeps what it is good at — scrolling, neutralising sticky
elements (`toggleStickyElements`, `content.js:464`), and measuring overlap — but
never holds the full image.

```
content script                background              offscreen document
─────────────────────────────────────────────────────────────────────────
fullpage_begin {w,h,dpr}  ──────────────────────────>  create canvas (budgeted)
  per section:
    scroll, settle, hide sticky
    fullpage_section {geom} ──> captureVisibleTab ──>  drawImage(section, destY)
  fullpage_finish  ──────────────────────────────────> convertToBlob(webp, 0.92)
                                                              │
                            ┌─────────────────────────────────┼──────────────┐
                      Downloads/SnapRec/            park in IndexedDB    480px thumb
                        (disk copy)                        │                  │
                                                 courier iframe → /editor  preview
```

Section images travel **background → offscreen** directly and never enter the
content script. Nothing large crosses IPC; the tab's memory stays flat. The
final image becomes a `Blob` via `convertToBlob`, which skips base64 entirely —
removing both the 33% inflation and the 64 MiB wall.

### D2 — A pixel budget instead of a cliff

`OffscreenCanvas` shares the ceiling from Defect 2, so the scale is computed
before any canvas is allocated:

```
PIXEL_BUDGET = 80_000_000          // headroom under the measured ~115 MP cliff
natural      = pageW * dpr * pageH * dpr
scale        = min(1, sqrt(PIXEL_BUDGET / natural))
```

At dpr 2 and a 1200px viewport this holds full resolution to about 16,600 CSS px
of page height, then degrades smoothly. Sections are drawn pre-scaled, so the
oversized canvas is never allocated at all. The scale is reported back so the UI
can say "captured at 70%" rather than quietly lying (G2).

### D3 — WebP at 0.92

Measured at 2400×8000: PNG 84 MB, **WebP q0.92 21.4 MB**, JPEG q0.92 21.3 MB.
WebP is chosen for the ~4× reduction at visually indistinguishable quality for
rendered page content. This is a deliberate lossless → lossy trade.

### D4 — Delivery reuses the recording pipeline

One Blob, three destinations, all built and verified in
`docs/superpowers/specs/2026-09-13-recording-durability.md`:

- **Disk** — the same `chrome.downloads` path, writing `.webp` into
  `Downloads/SnapRec/` (G3).
- **Editor** — parked in extension-origin IndexedDB under image-specific keys
  and delivered by `handoff/handoff.html`, which gains a `kind` parameter.
  `kind=video` remains the default so the verified recording path is untouched.
- **Preview** — a 480px-wide WebP thumbnail (~30 KB) returns to the content
  script. `showMiniPreview` currently receives the full-size image although the
  thumbnail is all it ever displays.

### D5 — Stop the offscreen document from destroying a recording

`createOffscreenDocument()` (`background.js:767`) **closes any existing offscreen
document before creating one**. Region capture already calls it, so taking a
region screenshot during a recording destroys that recording. Full-page capture
would inherit the same hazard.

It will reuse an open document instead of closing it, and declare
`chrome.offscreen.Reason.BLOBS` alongside the existing `DISPLAY_MEDIA` and
`USER_MEDIA`.

### D6 — The web editor accepts a Blob

`Editor.tsx:42-48` accepts only `{ type: 'SNAPREC_EDIT_IMAGE', dataUrl }` from
any origin. It will accept a `Blob` as well, reusing `readHandoffMessage` with a
new `image` kind, and keep the data-URL path for extensions that have not yet
updated. It must also persist the Blob to page-origin IndexedDB, because a
`blob:` URL in `sessionStorage` does not survive a refresh.

## Acceptance criteria

- **A1.** A 4,000px page at dpr 2 captures fully — the case that fails today.
- **A2.** A 32,000px page at dpr 2 produces a non-blank image, downscaled, and
  reports the scale applied.
- **A3.** No `SNAPREC` message carries more than 1 MB.
- **A4.** The capture is in `Downloads/SnapRec/*.webp` before the editor opens,
  and survives the editor failing to open.
- **A5.** A region screenshot taken during a recording does not end the
  recording.
- **A6.** An extension at the previous release still hands images to the updated
  editor.
- **A7.** The `/editor` canvas still renders after a page refresh.

## Risks

- The ~115 MP ceiling was measured on one machine and is likely memory-
  dependent. `PIXEL_BUDGET` carries roughly 30% headroom; if reports of blank
  captures persist, lower it rather than assuming a different root cause.
- Scroll-and-stitch fidelity limits remain (non-goals above); this design does
  not improve them.

## Verification

Run 2026-09-13 against Chrome for Testing 145.0.7632.77, `devicePixelRatio: 2`,
1200px viewport, on high-entropy generated pages. 25/25 unit tests, 20/20
capture checks, 5/5 compatibility checks.

| Page | Plan | On disk | Cropped? | Time |
|---|---|---|---|---|
| 4,000 px | 2400×8000 webp, scale 1 | 0.19 MB | no | 8 s |
| 16,000 px | 2400×32000 **jpeg**, scale 1 | 5.08 MB | no | 26 s |
| 32,000 px | 1732×46188 **jpeg**, scale 0.722 | 12.83 MB | no | 52 s |

Every on-disk image matched its planned dimensions exactly — A1, A2 and A4 hold,
and A3 held with no "exceeded maximum allowed size" anywhere. A5 was checked by
holding a blob in the offscreen document and taking a full-page screenshot: the
document and the blob both survived. A6 was checked by posting the legacy
same-origin `dataUrl` shape to the updated editor, which still rendered it. A7
held across a reload of `/editor`.

### Correction found during verification — the format's dimension limit

The first run produced images that were **silently cropped**: a 16,000px page
came back 2400×16383 instead of 2400×32000, losing half its height with nothing
logged. WebP has a hard 16383 px per-dimension limit and `convertToBlob` does
not refuse an oversized canvas — it crops. The megapixel budget alone did not
catch this, because 2400×32000 is 76.8 MP, comfortably inside it.

`capturePlan` now decides scale and format together. WebP is kept while both
dimensions fit within 16383; beyond that the capture switches to JPEG, whose
limit is 65535, so a tall page keeps its resolution by changing container rather
than by losing pixels. Without the switch, fitting a 16,000px page into WebP
would have forced a 0.51 scale and cut its width from 2400 to 1228.

`finishFullPage` additionally re-decodes the encoded blob and throws if its
dimensions do not match the canvas, so a future limit of this kind fails loudly
instead of silently truncating.
