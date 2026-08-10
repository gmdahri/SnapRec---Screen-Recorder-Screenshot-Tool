# Responsive Video Viewer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the desktop and mobile video viewers to match the approved near-black, cool-gray, white, and cyan reference while retaining all existing behavior.

**Architecture:** Keep `VideoViewer` and `MobileVideoShare` as the existing desktop/mobile presentation boundaries selected by `ShareShell`. Extend only the mobile presentation contract with already-available metadata, watch percentage, actions, and generated frames; do not add endpoints, models, routes, or state. Put responsive layout rules in the existing web stylesheet and keep behavior assertions at component boundaries.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Iconify, `@snaprec/design-system` tokens and primitives.

## Global Constraints

- The supplied expected-design image is the visual source of truth.
- Preserve all player, comments, frame generation, seeking, permission, loading, empty-state, and callback behavior.
- Use existing `--sr-*` tokens and bundled fonts; do not add gradients, `dark:` variants, or a competing color system.
- “Chapters” is a presentation-only rename of generated frames.
- Transcript is visible but disabled and has no content or interaction.
- Show `watchedPercent` only when it is a number; omit it when `null`.
- Keep all interactive mobile targets at least 44px.
- Desktop must fit in one viewport without document-level vertical scrolling; the rail may scroll internally. Mobile keeps natural document scrolling.

---

### Task 1: Pin the New Viewer Semantics with Tests

**Files:**
- Modify: `apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx`
- Modify: `apps/web/src/pages/Share/__tests__/mobileShare.test.tsx`

**Interfaces:**
- Consumes: existing `VideoViewerProps`, `MobileVideoShareProps`, and `VideoFrame` shape.
- Produces: regression coverage for disabled Transcript, Chapters copy, watched visibility, and unchanged seeking/actions.

- [ ] **Step 1: Replace the obsolete desktop transcript assertions**

Assert that the new tab is present but unavailable:

```tsx
it('shows Transcript as an unavailable tab', () => {
  render(<VideoViewer {...base} />);
  expect(screen.getByRole('tab', { name: /Transcript/ }))
    .toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('tab', { name: /Transcript/ })).toBeDisabled();
});
```

- [ ] **Step 2: Add the desktop chapter-label assertion**

Inside the existing filmstrip suite, render `frames` and assert:

```tsx
expect(screen.getByTestId('viewer-frames')).toHaveTextContent('CHAPTERS');
expect(screen.getByTestId('viewer-frames')).not.toHaveTextContent('FRAMES');
```

- [ ] **Step 3: Add mobile metadata, metric, transcript, and chapter assertions**

Create a mobile capture with `watchedPercent: 87`, pass the existing `vComments` and two frames, then assert `87%`, disabled Transcript, `CHAPTERS`, and the two jump buttons. Keep the current 44px-target and overflow-action tests unchanged.

```tsx
const frames = [
  { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
  { startSec: 39, sampleSec: 39.5, dataUrl: null },
];
expect(screen.getByText('87%')).toBeInTheDocument();
expect(screen.getByRole('tab', { name: /Transcript/ })).toBeDisabled();
expect(screen.getByTestId('mobile-chapters')).toHaveTextContent('CHAPTERS');
expect(screen.getAllByRole('button', { name: /Jump to/ })).toHaveLength(2);
```

- [ ] **Step 4: Run the focused tests and verify the new assertions fail**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/VideoViewer.test.tsx src/pages/Share/__tests__/mobileShare.test.tsx`

Expected: FAIL because Transcript and mobile chapters/metrics are not rendered and desktop still says `FRAMES`.

- [ ] **Step 5: Commit the test contract**

```bash
git add apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx apps/web/src/pages/Share/__tests__/mobileShare.test.tsx
git commit -m "test(web): define responsive viewer redesign"
```

### Task 2: Restyle the Desktop Viewer

**Files:**
- Modify: `apps/web/src/pages/Share/VideoViewer.tsx`
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx`

**Interfaces:**
- Consumes: unchanged `VideoViewerProps`; existing `capture.watchedPercent`, handlers, comments, and frames.
- Produces: the desktop reference layout and a three-item rail tablist where Transcript is disabled.

- [ ] **Step 1: Add the disabled Transcript tab without extending state**

Keep `RailTab` as `'comments' | 'details'`. Render a fixed tab descriptor list and prevent disabled selection:

```tsx
const railTabs = [
  { key: 'comments' as const, label: `Comments ${comments.length}` },
  { key: 'transcript' as const, label: 'Transcript —', disabled: true },
  { key: 'details' as const, label: 'Details' },
];
```

For Transcript set `disabled`, `aria-disabled="true"`, `aria-selected={false}`, and a `not-allowed` cursor. Comments and Details retain their current `setTab` behavior.

- [ ] **Step 2: Match the desktop structure to the reference**

Update only presentation styles/classes: 50px carbon header, compact square action buttons, cyan Copy link, page padding near 22px, a fluid `minmax(0, 1fr) 312px` workspace, square video/rail borders, and a rail that aligns to the stage and holds the composer at its bottom. Keep every action conditional and handler unchanged.

- [ ] **Step 3: Align metadata, statistics, and chapters**

Keep the existing title, editable description, and statistic mapping. Tighten the metadata row, render white stat cells with hairline separators, preserve the signed-in-viewer tooltip, and change only the visible section heading:

```tsx
<span style={{ ...mono, letterSpacing: '.12em' }}>CHAPTERS</span>
```

Lay cards in three reference-like columns at desktop widths while retaining their generated images, timestamps, active state, `aria-current`, and `onSeek` calls.

- [ ] **Step 4: Centralize responsive viewer geometry in `index.css`**

Replace the current rail-only overrides with scoped classes for the workspace, content column, rail, metadata row, stats, and chapters. At `max-width: 1023px`, stack the rail without overlaying the video; at desktop widths, keep the rail beside the stage. Do not change global design tokens.

- [ ] **Step 5: Run the desktop viewer tests**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/VideoViewer.test.tsx`

Expected: PASS, including existing action, seeking, comment, description, statistics, and frame behavior tests.

- [ ] **Step 6: Commit the desktop redesign**

```bash
git add apps/web/src/pages/Share/VideoViewer.tsx apps/web/src/index.css apps/web/src/pages/Share/__tests__/VideoViewer.test.tsx
git commit -m "feat(web): restyle desktop video viewer"
```

### Task 3: Bring the Reference Layout to Mobile

**Files:**
- Modify: `apps/web/src/pages/Share/MobileVideoShare.tsx`
- Modify: `apps/web/src/pages/Share/ShareShell.tsx`
- Modify: `apps/web/src/index.css`
- Test: `apps/web/src/pages/Share/__tests__/mobileShare.test.tsx`

**Interfaces:**
- Consumes: `capture` fields already present on `ShareShellProps`, existing callbacks, `frames?: VideoFrame[]`, and generation/block flags.
- Produces: an expanded `MobileVideoShareProps` presentation contract with no new network or domain state.

- [ ] **Step 1: Extend the mobile presentation props**

Add optional presentation fields and existing handlers:

```tsx
export interface MobileVideoShareProps {
  capture: ShareCapture & {
    createdAt?: string;
    dimensions?: string;
    description?: string;
    views?: number;
    watchedPercent?: number | null;
    canEdit?: boolean;
  };
  frames?: VideoFrame[];
  framesGenerating?: boolean;
  framesBlocked?: boolean;
  onBack?: () => void;
  onCopyLink?: () => void;
  onEdit?: () => void;
  // retain all existing members unchanged
}
```

Import `VideoFrame`. `ShareShell` already spreads these values into `MobileVideoShare`; do not add data fetching or transformation.

- [ ] **Step 2: Recompose the mobile header and metadata**

Use the reference carbon header with Back, truncated title, status, and More. Keep Download, Edit, and Copy link in the existing `BottomSheet`, conditionally matching permissions and invoking the supplied callbacks before closing. Below the sticky dark player, render title, owner/date/duration/dimensions, optional description, and Views/Watched/Comments cells.

- [ ] **Step 3: Add the responsive rail tabs**

Add local state `type MobileTab = 'comments' | 'details'`. Render Comments and Details as functional tabs and Transcript as a disabled tab with `disabled` and `aria-disabled="true"`. Reuse the existing comment list/composer unchanged under Comments; show capture metadata under Details.

- [ ] **Step 4: Render generated frames as Chapters**

When frames exist, render `data-testid="mobile-chapters"` after the rail. Use a horizontal snap-scrolling list of buttons, retain `aria-label="Jump to …"`, and call the unchanged `onSeek(frame.startSec * 1000)`. Show the existing generation and blocked messages verbatim.

- [ ] **Step 5: Preserve mobile accessibility rules**

Set `data-min-target="44"` on every new actionable button and ensure CSS gives each at least 44px. Keep the player sticky, visible focus styles, readable 12px minimum body copy, and no horizontal page overflow.

- [ ] **Step 6: Run the mobile and shell tests**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/mobileShare.test.tsx src/pages/Share/__tests__/surface.test.ts`

Expected: PASS, including sticky-player, timecode seeking, overflow actions, 44px targets, watched percentage, disabled Transcript, and Chapters.

- [ ] **Step 7: Commit the mobile redesign**

```bash
git add apps/web/src/pages/Share/MobileVideoShare.tsx apps/web/src/pages/Share/ShareShell.tsx apps/web/src/index.css apps/web/src/pages/Share/__tests__/mobileShare.test.tsx
git commit -m "feat(web): restyle mobile video viewer"
```

### Task 4: Verify Behavior and Visual Fidelity

**Files:**
- Verify: `apps/web/src/pages/Share/VideoViewer.tsx`
- Verify: `apps/web/src/pages/Share/MobileVideoShare.tsx`
- Verify: `apps/web/src/pages/Share/ShareShell.tsx`
- Verify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: the completed desktop/mobile presentation changes.
- Produces: test, build, and visual evidence that the redesign is complete without functional regression.

- [ ] **Step 1: Reproduce the desktop page scroll with a browser geometry test**

Extend the Puppeteer fixture in `VideoViewer.test.tsx` with representative frames and metadata at 1440×1024. Assert that the desktop root and document do not exceed the viewport while the comment list retains internal scrolling:

```tsx
expect(geometry.documentScrollHeight).toBeLessThanOrEqual(geometry.viewportHeight);
expect(geometry.rootBottom).toBeLessThanOrEqual(geometry.viewportHeight);
expect(geometry.railScrollHeight).toBeGreaterThan(geometry.railClientHeight);
```

Run the focused test before implementation and confirm it fails because `.sr-viewer-page` currently uses natural overflowing content height.

- [ ] **Step 2: Constrain desktop geometry to one viewport**

In `VideoViewer.tsx`, give the root a stable class instead of relying on `minHeight: 100vh`. In `index.css`, at desktop widths only, set the root to `height: 100dvh; overflow: hidden`, size the main page to the remaining 50px-header area, and cap the stage using both available width and available viewport height so metadata and a single horizontal chapter row remain visible. Keep the rail aligned to the stage with internal comment scrolling. Do not hide metadata or chapters, and do not apply the height lock below 1024px.

- [ ] **Step 3: Run the focused geometry and viewer tests**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__/VideoViewer.test.tsx`

Expected: PASS with no document-level desktop overflow and all existing viewer behaviors intact.

- [ ] **Step 4: Run all share-view tests**

Run: `npm test --workspace=apps/web -- --run src/pages/Share/__tests__`

Expected: PASS with zero failed tests.

- [ ] **Step 5: Run the complete web test suite**

Run: `npm test --workspace=apps/web`

Expected: PASS with zero failed test files.

- [ ] **Step 6: Run lint and production build**

Run: `npm run lint --workspace=apps/web`

Expected: exit 0 with no ESLint errors.

Run: `npm run build --workspace=apps/web`

Expected: exit 0 after TypeScript and Vite complete.

- [ ] **Step 7: Inspect desktop and mobile in the browser**

Run `npm run dev --workspace=apps/web`, open a populated `/v/:id` recording, and capture screenshots at 1440×1024 and 390×844. Compare header height/actions, cyan accents, square panel borders, stage/rail proportions, metadata, statistic cells, disabled Transcript, comments/composer, and Chapters to the supplied reference. Repeat with zero comments, `watchedPercent: null`, and unavailable previews.

- [ ] **Step 8: Review the final diff for forbidden scope changes**

Run: `git diff --check && git diff --stat && git status --short`

Expected: no whitespace errors and no changes to server, API, migrations, hooks, routing, or recording models.

- [ ] **Step 9: Commit any visual-only corrections**

```bash
git add apps/web/src/pages/Share/VideoViewer.tsx apps/web/src/pages/Share/MobileVideoShare.tsx apps/web/src/pages/Share/ShareShell.tsx apps/web/src/index.css apps/web/src/pages/Share/__tests__
git commit -m "fix(web): align video viewer with approved reference"
```
