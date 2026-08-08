# SnapRec "Plate" Redesign — P0/P1/P2 Design

**Date:** 2026-08-05
**Status:** Approved (architecture); not yet planned or implemented
**Source design:** `~/Downloads/Design System_ SnapRec Recording (2)/`

---

## 1. Context

Three design documents were produced, in sequence rather than as alternatives:

| File | What it is |
|---|---|
| `SnapRec Style Tiles.dc.html` | Turn 1 — three palette directions (1a Viewfinder / 1b Instrument panel / 1c Contact sheet). 1a recommended. |
| `SnapRec Optical Workbench.dc.html` | Turn 2 — three art directions (2a "the plate" / 2b "the strip" / 2c "coordinate field"). **2a recommended**, adopting 2c's anchored pins for screenshots and keeping 2b's frame strip only as the video timeline. |
| `SnapRec Plate Prototype.dc.html` | Turn 3 — 2a built out as a 21-scene clickable prototype plus the system reference. **This is the design of record.** |

The Style Tiles palette (indigo `#4A45C9`, IBM Plex) was superseded by the plate palette (cyan `#06A6C0`, Schibsted Grotesk / Azeret Mono). Where the two disagree, the Plate Prototype wins.

### Premises in the design that do not match the repository

1. **The Style Tiles assume Ant Design** — "cheapest path from the current React 19 + antd stack." There is no antd in this repo; `apps/web` is Tailwind v4. The `ant-design:*` icon names are Iconify identifiers and are usable without the library. **Decision: no antd.**
2. **"Convert HTML to React" does not apply uniformly.** `apps/extension` is plain JS with no build step; `ship-to-store.sh` simply zips the folder. An orphaned, untracked, unreferenced `apps/extension/dist/popup/` exists from an abandoned React attempt and will be deleted.
3. **This is a brand replacement, not a reskin.** Purple `#7b25f4` + glassmorphism + 8–24px radii + Inter → flat cyan/coral + 0–2px radii + Schibsted Grotesk.

### Pre-existing defect this work must resolve

`apps/web/tailwind.config.js` declares `darkMode: 'class'`, but Tailwind v4 does not load a JS config without an `@config` directive, and `src/index.css` has none. The file is dead — including its `primary: #7b25f4`, which is why the live primary is `#8b5cf6` from the `@theme` block. `<html class="light">` therefore does nothing, and the 279 `dark:` utilities compiled against v4's default variant. Verified in the built CSS:

```
@media(prefers-color-scheme:dark){.dark\:border-\[\#1c142b\]{border-color:#1c142b}...}
.dark class variant present? → 0
```

Any visitor whose OS is in dark mode — including recipients of shared links — currently sees an undesigned dark UI.

---

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Ship **P0 foundation + P1 extension + P2 share/completion** first | These are the only surfaces the prototype actually draws. The other ~60% would be my interpretation. |
| D2 | Completion plate (B1–B6) is a **web app route** | Matches its light styling; reuses upload/link code and P0 primitives; avoids a second hand-rolled implementation in the content script. |
| D3 | Extension popup is **React + Vite** | Nine states across two modes is real state. Enables primitive sharing with the web app. |
| D4 | **Strip all 279 `dark:` utilities; management surfaces are light-only** | Matches the design's rule. Dark is reserved for Technical workspaces (editors, P4), which get explicit dark tokens rather than a variant. |
| D5 | **Brand mark lands in P0** — `Logo.tsx`, favicon, four extension icon sizes | The mark is pure geometry, so it ships as an inline SVG with no asset export. |
| D6 | **Web ships first, backward-compatible**, then the extension is submitted | Web deploys instantly; the Web Store takes days. New routes must serve the current extension for one release cycle. |
| D7 | **No Ant Design** | Icons come from `@iconify-json/ant-design`. Pulling in antd to build 0–2px-radius custom compositions is cost with no payoff. |
| D8 | Shared layer lives in **`packages/design-system`** | `packages/` already exists, is empty, and the root `package.json` already globs `packages/*`. |

### Non-goals

Out of scope for this spec, deferred to later sub-projects:

- **P3** — dashboard, library, projects, settings, auth (design names these "Quiet" but draws none of them)
- **P4** — screenshot (Fabric) editor and video editor ("Technical"; ~3,800 LOC)
- **P5** — marketing, blog, SEO landing pages ("Quiet"; ~4,000 LOC + 37 posts, prerendered and SEO-tuned)
- `og-image.png` and Chrome Web Store screenshots — they advertise surfaces that will still be purple

A visually mixed application during this period is an accepted, deliberate cost.

---

## 3. The plate system

Extracted from the Plate Prototype's "Shared, not re-decided" panel, which is normative.

### Palette

| Role | Value | Use |
|---|---|---|
| Carbon | `#0C1011` | Dark surface background; capture surfaces |
| Media well | `#040708` | Behind media on dark |
| Panel (dark) | `#14191B` | Grouped rows inside dark surfaces |
| Border (dark) | `#2A3234` `#22292B` `#3A4245` | Hairlines / dividers / secondary button |
| Text (dark) | `#F3F6F6` `#C1CACC` `#8D989B` `#5E686B` | Primary / secondary / muted / faint |
| Paper | `#FAFBFB` | Light surface background; management surfaces |
| Panel (light) | `#EEF1F1` | Plate background, grouped areas |
| Border (light) | `#C7CFD0` `#DCE1E2` | Hairlines / dividers |
| Text (light) | `#0C1011` `#2B3234` `#4B5457` `#5F6A6D` `#6B7477` `#8D989B` | Primary → faint |
| **Cyan** | `#06A6C0` | Focus, selection, sharing. Foreground on cyan fill is `#03252B`. Hover `#0FBBD6`. On light text, `#0A7F94`. Tint `#DFF4F8`. |
| **Coral** | `#D8331F` text-bearing, `#FF3B2E` marks | Live capture and needs-a-response **only**. Hover `#B82A18`. Light coral text `#FF7A6E` on dark. |
| Green | `#1F9D62` | Completed node on the path spine |

Coral discipline is the load-bearing rule of the system: if coral appears anywhere that is not live capture or awaiting a response, the design has been diluted. A screenshot capture action is **carbon, not coral**, because a screenshot is instantaneous.

### Geometry, type, motion

- **Type** — Schibsted Grotesk (UI), Azeret Mono (all numerics, metadata, status words, shortcuts)
- **Control heights** — 30 / 34 / 40 / 46
- **Radius** — `0` on media and rails, `2px` on controls. Nothing else.
- **Icons** — ant-design outlined, 13–17px
- **Focus** — 1px cyan border + 3px cyan at 18% opacity
- **Motion** — 120 / 180 / 220ms. The signature gesture is a **corner strike** reused at exactly three moments: countdown, capture completion, link creation.
- **Status vocabulary** (fixed strings, never paraphrased) — `on this device` · `uploading` · `saved to library` · `link ready` · `processing` · `private` · `shared` · `needs a reply`

### Frame treatments — three, only three

A viewer must be able to tell from the frame alone whether media can be manipulated.

| Treatment | Appearance | Where |
|---|---|---|
| **Editable** | Solid cyan handles + live dimension read-out | Only where media can actually be resized or cropped: region selection, crop, editor selection, video zoom regions, webcam overlay |
| **Focused** | Passive registration marks **inset** from corners, never on the boundary | Current object of attention: extension preview, completion plate, share media, selected library item |
| **Passive** | 1px boundary, nothing else | Default. Library previews, list rows, processing states, thumbnails, analytics |

The other two must be earned. This rule is why the popup preview carries inset marks and not handles — it cannot be resized, so it must not look draggable.

### Intensity levels

| Level | Surfaces | Allowed |
|---|---|---|
| **Quiet** | Home, library, projects, settings, auth, marketing | Passive frames. No rulers, no coordinates. Mono only for durations, dimensions, timestamps. |
| **Focused** | Extension, capture completion, public share | Focused frames, edge-attached actions, path spine, selected metadata. |
| **Technical** | Region selection, image editor, video editor, crop, timeline, zoom | Handles, coordinates, rulers, timecodes, audio levels, tool rails. **Dark workspaces permitted here and nowhere else.** |

Every screen declares its level, and the level decides how much technical machinery is permitted. This is what lets P3/P4/P5 be extrapolated later without re-deciding the language.

### Dark and light are one system

The extension is dark because it sits over arbitrary web pages and next to media. The web app is light because it is for reading and managing. **Only two things change:** which end of the neutral ramp is the background, and whether borders are `#2A3234` or `#C7CFD0`. Cyan, coral, geometry, type and language are identical.

---

## 4. P0 — Design foundation

### Package

```
packages/design-system/
  package.json          name: @snaprec/design-system, type: module
  tokens.css            all tokens as CSS custom properties, both surface modes
  fonts/                self-hosted Schibsted Grotesk + Azeret Mono (woff2, subset latin)
  fonts.css             @font-face, font-display: swap
  icons.ts              re-exports the ~30 used icons from @iconify-json/ant-design
  primitives/
    Button.tsx          variant: primary | secondary | ghost | capture | carbon
                        size: 30 | 34 | 40 | 46
    IconButton.tsx      square, tooltip + accessible name required
    Frame.tsx           treatment: editable | focused | passive; optional readout
    SegmentedControl.tsx  radiogroup semantics, used for source / quality / fps / countdown
    Switch.tsx          role="switch", 26×15, square knob
    StatusChip.tsx      accepts only the fixed status vocabulary
    PathSpine.tsx       four nodes: on this device → uploading → saved to library → link ready
    Mono.tsx            Azeret Mono span with tabular numerals
    Field.tsx           input with the cyan focus ring
    Logo.tsx            inline SVG mark (corner brackets + coral square), currentColor
  motion.ts             durations, easing cubic-bezier(.2,.8,.2,1), cornerStrike keyframes
  index.ts
```

`PathSpine` is deliberately a primitive rather than a completion-plate detail: the design reuses the same four nodes as the upload progress bar **and** as the status line on library cards (P3).

### Consumers

- **Web** — `@import "@snaprec/design-system/tokens.css"` in `src/index.css`, then `@theme inline` mapping so Tailwind utilities generate *from* the same custom properties rather than a parallel copy.
- **Extension popup** — imports `tokens.css` and primitives directly through its own Vite build.
- **Content scripts** — vanilla; `tokens.css` is imported as a raw string and injected into a **Shadow DOM** root. This also fixes today's exposure to arbitrary page CSS.

### MV3 constraints the design's own HTML violates

The prototype loads Iconify and Google Fonts from CDNs. **MV3's Content Security Policy blocks both in an extension page.** Therefore:

- Icons are bundled from `@iconify-json/ant-design` at build time; no runtime `<iconify-icon>` web component, no CDN script.
- Fonts are self-hosted woff2 in the package. This is also correct for the web app — prerendered marketing pages must not shift layout waiting on a Google Fonts round-trip.

### Web app cleanup (part of P0)

- Delete `apps/web/tailwind.config.js` (already dead — no `@config` directive loads it)
- Remove all 279 `dark:` utilities; remove `class="light"` from `index.html`
- Replace the `@theme` block in `src/index.css` with the plate tokens
- Replace `Logo.tsx`'s `<img src="/logo.png">` with the inline SVG mark; regenerate `favicon`
- Redraw the four extension icon PNGs (16/32/48/128) from the SVG mark

Non-converted surfaces (dashboard, marketing) will inherit the new tokens and lose their dark variants in this step. They will look transitional until P3/P5. This is accepted per §2.

### Build-system risk

The root `Dockerfile` copies each workspace `package.json` **by name** and then runs `npm ci --workspace=apps/server --include-workspace-root`. Adding `packages/design-system` to the lockfile without adding a matching `COPY` line will fail the server image build. Two lines, but a silent CI break if missed:

```dockerfile
COPY packages/design-system/package.json packages/design-system/package.json
```

…required in **both** the `build` and `runtime` stages. `.dockerignore` also needs a `packages/*` exclusion consistent with its existing `apps/web/*` treatment.

---

## 5. P1 — Extension

### Popup: A1–A9

New source at `apps/extension/popup-src/`, Vite `outDir: ../popup`, manifest points at `popup/index.html`. The current `popup/popup.html`, `popup.css` and `popup.js` are **deleted** — build output and hand-written source cannot share that directory. `popup/` becomes generated and gitignored; `ship-to-store.sh` builds it before zipping, and loading unpacked requires a build first (a change to the current workflow, and the reason `CLAUDE.md` needs updating).

| Scene | State | Notes |
|---|---|---|
| A1 | Ready to record | **Six controls only**: mode, source, mic, tab audio, camera, capture. Everything else behind "Recording options". Focused frame on the live tab preview. Primary action coral, 46px, `⌥⇧R` shown. |
| A2 | Screenshot mode | Same shell; three capture areas (visible / region / full page). **Audio rows are removed, not disabled.** Capture action is carbon, not coral. |
| A3 | Recording options | The only Technical-level surface in the extension. Quality, fps, devices, countdown, auto-zoom, cursor, click highlight, after-capture. Mic level meter appears **only here** and while recording. Slides in 180ms, interruptible; panel scrolls, header and Done fixed. |
| A4 | Permission required | Occupies the preview area only — popup does not resize. Cyan, not coral: nothing is wrong yet. Offers "Record without microphone". |
| A5 | Permission denied | Coral left rule + the word "blocked". Three concrete numbered steps, "Open site settings", and **"Check again"** which re-queries without a reload. |
| A6 | Countdown | 360×440. Coral corner strike inward; numeral scales 1.25→1 over 300ms. Esc cancels; nothing written yet. |
| A7 | Recording | Popup header becomes a solid coral bar with pulsing dot + mono timer. Live mic meter. Pause / Finish. |
| A8 | Paused | **Coral drops from fill to outline** — distinguishable in a still screenshot. Timer freezes. Discard separated below, confirms with the duration to be lost. |
| A9 | Finishing | Indeterminate cyan sweep, not a fake percentage. States plainly that the file is being written locally and nothing has been uploaded. |

Accessibility is specified per-scene and is not optional: mode is a `tablist`, source a `radiogroup`, inputs are `switch`es with labels; tab order runs top to bottom ending on the capture action; every state is named in text, never by colour alone; A4 moves focus to the heading with `aria-live`.

### In-page control bar (content script, vanilla + Shadow DOM)

Three forms: **expanded** (drag handle, timer, pause, mic, camera, draw, restart, Finish), **minimized** (dot, timer, pause, expand), and **paused** (coral border, hollow dot, `{elapsed} paused`, Resume, Finish).

Constraints: carbon body, 1px border, strong outer shadow, fixed 42px height, never inherits page fonts. Reachable as a landmark via `⌥⇧B`. Elapsed time is an `aria-live="polite"` region updated **every 10s, not every second**. Only the record dot animates (1.6s opacity pulse); under `prefers-reduced-motion` it holds solid and the word "Recording" carries the state.

### Region selector (content script)

The one place in the extension that earns the **editable** frame: solid cyan handles plus a live dimension read-out.

### Build and release changes

- `apps/extension/package.json` gains `build` (Vite) and dependencies
- `ship-to-store.sh` must **build before zipping** and exclude `popup-src/`, `node_modules/`, `vite.config.js`
- Delete the orphaned `apps/extension/dist/`
- `manifest.json`: popup path, and `web_accessible_resources` updated for the new token stylesheet
- `CLAUDE.md` extension section updated — it currently states "no build step required"

### Keyboard shortcuts conflict with the manifest

The design prints shortcuts as visible text in A1, A2 and A7, so they are part of the UI and cannot be quietly ignored. They do not match what `manifest.json` declares:

| Action | Manifest today | Design |
|---|---|---|
| Start recording | `Ctrl/⌘+Shift+4` | `⌥⇧R` |
| Capture visible | `Ctrl/⌘+Shift+3` | `⌥⇧S` |
| Select region | `Ctrl/⌘+Shift+2` | `⌥⇧D` |
| Capture full page | `Ctrl/⌘+Shift+1` | — (no shortcut shown) |
| Focus in-page bar | — | `⌥⇧B` (new) |

Chrome permits at most four `suggested_key` entries, so adopting the design means dropping full-page's binding to make room for `⌥⇧B`. Users who have customised their bindings keep them; everyone else silently moves. **Adopting the design's shortcuts is the default assumption** — if the existing bindings should be kept instead, the popup and bar copy must be changed to print the real ones, because the design's rule is that a shortcut is never the only route to an action but is always named accurately.

---

## 6. P2 — Web (ships first)

### 6a. Completion route — B1–B6

New route **`/capture/:id`**, light surface, 600px plate, `border-top: 2px solid #0C1011`. Arrives with the corner strike (220ms), then the spine draws its first segment.

| Scene | State |
|---|---|
| B1 | On this device — the capture is already safe; upload is optional |
| B2 | Uploading — cancellable; closing the window does not stop it |
| B3 | Upload failed — coral marks the break in the spine; retry or keep local |
| B4 | Offline — queued, **no error language**; nothing has gone wrong |
| B5 | Saved to library — uploaded, no link; link creation is a separate act |
| B6 | Link ready — **only now does "Copy link" exist** |

Two rules with teeth:

- **No button may pretend a link exists.** B1's primary action is "Upload and get link", naming its outcome. `Copy link` appears at B6 and nowhere earlier.
- **The path spine is the same component** as the upload progress bar and the library card status line.

Edge-attached action rail (42px, carbon) on the media's right edge: copy, download, annotate, save to Drive, discard. Media carries the **focused** frame; only "Annotate" (→ editor) grants solid handles.

This route absorbs post-capture responsibility currently spread across `ShareView.tsx` (guest upload via `useGetUploadUrl` / `useCreateRecording` / `uploadFile`) and the `content.js` screenshot mini-preview. Per D6 it must accept the **current** extension's payload for one release cycle. Add `Disallow: /capture/` to `public/robots.txt`.

### 6b. Share view — C1–C6

`ShareView.tsx` (962 LOC) is rebuilt. **Zero SEO risk**: `/v/` is `Disallow`ed in `robots.txt` and absent from `prerender.mjs`, verified.

| Scene | Layout |
|---|---|
| C1 | Video share, 1120px. Carbon 52px header, 72px right-aligned mono metadata margin. **Comments anchor to timecodes**; markers are real buttons on the timeline; comment columns begin at their timecode's horizontal position so the conversation reads as a shape before it is read. |
| C2 | Screenshot share. **Comments anchor to x/y pins** joined by hairline leaders. Pin states: outline = unselected, cyan fill = selected, coral outline = needs a reply, 40% grey = resolved (collapsed under "2 resolved"). Numbers make pins distinguishable without colour. |
| C3 | Video, mobile 390px — media pinned, comments become a sheet |
| C4 | Screenshot, mobile — **leaders dropped entirely** below a 300px margin; selecting a comment lights its pin |
| C5 | Private capture — Quiet level. No media, no machinery, one request action. |
| C6 | Processing — known metadata shown, frame stays **passive** |

### 6c. Backend changes (required, not optional)

`sr_comments` currently has only `content`, `guestId`, `user`, `createdAt`, `updatedAt`. The design requires anchoring, resolution and threading. New TypeORM migration:

| Column | Type | For |
|---|---|---|
| `timecodeSeconds` | `numeric(10,3)` null | C1 video comments |
| `anchorX`, `anchorY` | `numeric(6,5)` null | C2 pins, stored as 0–1 fractions so they survive resolution changes |
| `resolvedAt` | `timestamptz` null | resolved state |
| `resolvedByUserId` | uuid null | audit |
| `parentId` | uuid null, self-FK | replies |

Accompanying changes: `AddCommentDto` (validated, mutually exclusive anchor kinds — a comment is timecode-anchored **or** point-anchored, never both), a resolve endpoint, `RecordingsService.addComment`, and the `Comment` entity registered as already required in **both** `app.module.ts` and `data-source.ts`.

Anchors are nullable throughout, so existing comments render as unanchored and nothing is lost.

### 6d. Component boundary risk

`VideoPlayer.tsx` (424 LOC) is shared by `ShareView` **and** four `VideoEditor` files. P2 must not destabilise the video editor, which is P4 work. Approach: leave `VideoPlayer` untouched and build a separate share player with the plate's timeline-marker affordances, accepting temporary duplication, then reconcile in P4. Refactoring a component with five consumers mid-redesign trades a contained risk for an uncontained one.

---

## 7. Open decision — advertising on the share page

C1 specifies "no promotion, no sidebar, no cards." `ShareView.tsx` currently renders `<GoogleAd>` against `VITE_ADSENSE_SHARE_SLOT`. These are incompatible.

This is a revenue decision and is **not** mine to make silently. Options: honour the design and remove share-page ads; keep the ad in a defined slot below the plate (violating the design least); or keep it and accept the design breach. **Requires an answer before P2 implementation begins.**

---

## 8. Sequencing and testing

```
P0 foundation ──┬── P2 web (deploy first, backward-compatible)
                └── P1 extension (submit to Web Store after P2 is live)
```

**Verification per stage:**

- **P0** — `npm run build` in web and server both pass; the Docker image builds (proves the `COPY` fix); a token-contrast check asserts every text/background pair in `tokens.css` meets WCAG AA, since coral's split into `#FF3B2E` marks vs `#D8331F` text exists precisely for this reason
- **P1** — extension loads unpacked; A1→A6→A7→A9→completion runs end to end; popup paints in under 100ms; keyboard-only traversal of every scene; `prefers-reduced-motion` honoured in the countdown and record pulse
- **P2** — new migration runs and reverts cleanly; existing unanchored comments still render; the **current** extension can still complete a capture against the new routes (D6); mobile C3/C4 verified at 390px

The repo has one server test (`app.controller.spec.ts`) and no frontend test setup. This spec does not propose building a test infrastructure; verification above is manual plus build gates. Should that be wrong, it is a scope addition to raise before planning.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Docker build breaks on the new workspace | Explicit `COPY` lines in both stages; Docker build is a P0 gate |
| Web Store rejects or delays the extension | D6 — web ships first and stays backward-compatible; no user-facing break during review |
| Comment migration on production Supabase | All new columns nullable; forward migration only; revert tested locally first |
| Mixed purple/plate UI during transition | Accepted per D1. P0 tokens applied globally keep it merely transitional rather than broken |
| Coral dilution | Single most likely failure of the design. Codified: `StatusChip` accepts only the fixed vocabulary, and `Button`'s `capture` variant is the only coral-filled control |
| `VideoPlayer` shared with the video editor | Duplicate for the share view; reconcile in P4 (§6d) |
