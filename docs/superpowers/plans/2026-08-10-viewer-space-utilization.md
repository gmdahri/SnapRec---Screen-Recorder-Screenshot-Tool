# Viewer Space Utilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the full desktop viewer width and extend the discussion rail through the metadata row so its bottom aligns with the top of Chapters.

**Architecture:** Keep the current React structure and make its desktop wrapper boxes participate in one CSS grid. At desktop widths, `sr-viewer-workspace` and `sr-viewer-content-column` become `display: contents`; the stage, rail, metadata, and Chapters become grid items with the rail spanning the stage and metadata rows. Below 1024px, retain the current stacked layout and natural scrolling.

**Tech Stack:** React 19, TypeScript, CSS Grid, Vitest, Testing Library, Puppeteer, Vite.

## Global Constraints

- This is presentation-only; do not change state, callbacks, permissions, player behavior, comments, watched percentage, Transcript, Chapters/frame generation, APIs, routes, or backend models.
- Desktop remains within one viewport with a 16:9 stage and internal comment/metadata scrolling.
- The desktop rail consumes the remaining right-side width, with 312px as its minimum.
- The rail spans the stage and metadata rows; its bottom aligns with the top of Chapters.
- Chapters remain below the left column only.
- Below 1024px, preserve the current stacked/mobile layouts and natural document scrolling.
- Continue using existing `--sr-*` tokens and square panel styling.

---

### Task 1: Build and Verify the Full-Width Spanning Desktop Grid

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/pages/Share/VideoViewer.tsx`
- Test: `apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx`

**Interfaces:**
- Consumes: existing `VideoViewerProps`, current `sr-viewer-*` class names, the 50px header, and the desktop height variables.
- Produces: a desktop grid with `stage`, `rail`, `metadata`, and `chapters` grid areas; no public TypeScript interface changes.

- [ ] **Step 1: Rewrite the Chromium geometry expectations to describe the requested layout**

For each existing desktop viewport, measure the page, stage, rail, metadata, Chapters, and composer. Replace the old rail/stage-height equality with assertions equivalent to:

```tsx
expect(Math.abs(geometry.pageRight - geometry.railRight)).toBeLessThanOrEqual(1);
expect(geometry.railWidth).toBeGreaterThanOrEqual(312);
expect(Math.abs(geometry.railTop - geometry.stageTop)).toBeLessThanOrEqual(1);
expect(Math.abs(geometry.railBottom - geometry.chaptersTop)).toBeLessThanOrEqual(1);
expect(Math.abs(geometry.composerBottom - geometry.railBottom)).toBeLessThanOrEqual(1);
expect(Math.abs(geometry.frameRatio - (16 / 9))).toBeLessThan(0.01);
expect(geometry.documentScrollHeight).toBeLessThanOrEqual(geometry.viewportHeight);
```

Measure metadata overflow on `.sr-viewer-metadata-row`, because that row—not the vanished desktop wrapper box—will own long-copy scrolling. Keep the 1023px and 768px assertions proving the stacked layout remains unchanged.

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/VideoViewer.test.tsx`

Expected: FAIL because the rail currently ends at the video bottom and the capped workspace leaves unused width to its right.

- [ ] **Step 3: Assign explicit desktop grid areas without changing behavior**

At `min-width: 1024px`, make `.sr-viewer-page` the full-width grid and use the existing height-based stage cap:

```css
.sr-viewer-page {
  grid-template-columns:
    minmax(0, min(calc(var(--sr-viewer-stage-max-height) * 16 / 9), calc(100% - 326px)))
    minmax(312px, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  column-gap: 14px;
}

.sr-viewer-workspace,
.sr-viewer-content-column {
  display: contents;
}

.sr-viewer-stage { grid-column: 1; grid-row: 1; }
.sr-viewer-rail { grid-column: 2; grid-row: 1 / 3; }
.sr-viewer-metadata-row { grid-column: 1; grid-row: 2; }
.sr-viewer-chapters { grid-column: 1; grid-row: 3; }
```

Adjust syntax if needed for browser support while preserving the same track behavior. Override the rail's desktop `height: 0`/`min-height: 100%` with definite grid stretching. Give the metadata row `min-height: 0; overflow-y: auto` so a 2,000-character description remains reachable. Retain base/non-desktop declarations so `display: contents` and the row span do not leak below 1024px.

- [ ] **Step 4: Remove comments that describe the obsolete capped workspace**

Update only layout comments in `VideoViewer.tsx` and `index.css` to describe the full-width grid and two-row rail span. Do not move event handlers, state, or content.

- [ ] **Step 5: Run focused and responsive share tests**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/VideoViewer.test.tsx src/pages/Share/__tests__/mobileShare.test.tsx`

Expected: PASS, including full-width use, Chapters alignment, one-viewport containment, 16:9 media, internal scrolling, tablet stacking, sticky mobile playback, and 44px mobile targets.

- [ ] **Step 6: Run full verification**

Run: `npm test --workspace=apps/web`

Expected: all web tests pass.

Run: `npm run build --workspace=apps/web`

Expected: TypeScript and Vite exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

The repository's known ESLint/AJV `defaultMeta` startup failure is outside this task; do not change dependencies to mask it.

- [ ] **Step 7: Commit the presentation-only change**

```bash
git add apps/web/src/index.css apps/web/src/pages/Share/VideoViewer.tsx apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx
git commit -m "fix(web): use full viewer width"
```
