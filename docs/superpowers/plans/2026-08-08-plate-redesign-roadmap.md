# Plate Redesign P1–P6 — Roadmap

> **This is the index, not a plan.** Each phase has its own plan document with
> bite-sized TDD tasks. Execute phases in order; do not start a phase before its
> predecessor's exit criteria are met.

**Source of record:** `~/Downloads/SnapRec Standalone/` — four self-contained
prototype bundles holding 64 scenes. The scene manifests are the authority on
*what exists*; the annotation panels beside each scene are the authority on *why*.

**Already done (P0):** `packages/design-system` ships `tokens.css` plus ten
primitives (Button, IconButton, Frame, Logo, SegmentedControl, Switch, Mono,
Field, StatusChip, PathSpine), gated by a WCAG-AA contrast suite. `apps/web`
consumes the tokens through `@theme inline`. See
`docs/superpowers/plans/2026-08-05-p0-design-foundation.md`.

---

## Phase map

| Phase | Scope | Scenes | Plan |
|---|---|---|---|
| **P1** ✅ | Component layer — 8 new primitives + the 13-state capture model | — | `2026-08-08-p1-component-layer.md` |
| **P2** ⏸ | Extension: popup, capture completion, offline queue — code complete, awaiting Chrome verification + packaging | A1–A9, B1–B6 (15) | `2026-08-08-p2-extension-capture.md` |
| **P3** | Web app: shell, Home, Library, Projects, Shared, Analytics, Settings | H1–H6, L1–L9, PROJ, SHAR, ANLY, SETT (24) | `2026-08-08-p3-web-app.md` |
| **P4** | Share & viewer surfaces | C1–C6 (6) | `2026-08-08-p4-share-viewer.md` |
| **P5** | Editors & in-page overlays | V1–V6, I1–I4, P1–P2 (12) | `2026-08-08-p5-editors.md` |
| **P6** | Marketing & auth | M1–M2, A1–A5 (7) | `2026-08-08-p6-marketing-auth.md` |

**Total: 64 scenes.** The prototype cover page advertises 23 states for file 02
and 15 for file 04; the actual scene arrays hold 21 and 12. The cover page is
stale — trust the arrays.

---

## Dependency graph

```
P1 component layer
 ├─→ P2 extension          (CapturePlate, PathSpine, StateRule, StatusBadge)
 ├─→ P3 web app            (all eight)
 │     └─→ P4 share        (needs the Library item model + routing)
 │     └─→ P5 editors      (needs AppRail + the Projects surface)
 └─→ P6 marketing & auth   (Button/Field only — could run parallel to P2)
```

P6 depends on P1 alone and touches no surface P2–P5 touch. If you want two
tracks, run P6 alongside P2. Everything else is strictly sequential: P3 defines
the shell that P4 and P5 navigate back into.

---

## Global constraints

These apply to **every task in every phase**. They are inherited from the P0
spec and extended by the new prototypes. Values are verbatim.

### Carried forward from P0 — unchanged

- **No Ant Design library.** Icons come from `@iconify-json/ant-design` only.
  The prototypes name antd components (Menu, Popover, Modal, Drawer, …) as
  *behaviour donors* — copy the interaction and ARIA semantics, not the package.
- **No CDN at runtime.** Everything bundled. P2 ships into MV3 where remote
  scripts and styles are CSP-blocked.
- **Radius is `0` on media and rails, `2px` on controls.** No other radius.
- **Control heights are exactly 30 / 34 / 40 / 46.** No other heights.
- **Motion durations are exactly 120 / 180 / 220ms**, easing `cubic-bezier(.2,.8,.2,1)`.
- **Cyan foreground on cyan fill is `#03252B`** — never white.
- **Primitives read `var(--sr-*)`.** A hex literal in a `.tsx` file is a bug.
- **Management surfaces are light-only.** Dark is reserved for Technical
  workspaces (editors, the nav rail, the extension popup). No `dark:` utilities.
- **Every task ends with a commit. Do not push.**

### New, from the standalone prototypes

- **Coral is reserved for live capture and needs-a-response.** `#D8331F` where
  it bears text, `#FF3B2E` for marks. Three additional rules the prototypes make
  explicit:
  - *Screenshot capture is not coral* — a screenshot is instantaneous, so its
    action is carbon (scene A2).
  - *Paused drops coral to outline* — filled coral means capturing right now
    (scene A8).
  - *Offline is not coral* — queued work uses neutral grey and a dashed
    segment. Nothing has failed (scene B4).
- **The corner strike fires exactly three times** in a capture's life: the
  countdown (A6), capture completion (B1), and link resolution (B6). 220ms.
  Nowhere else, ever.
- **Green (`--sr-green`) appears only on completed path-spine nodes.** Never a
  button, badge colour, or background (scene B5).
- **Status never rests on hue alone.** Every state carries its word. The coral
  rule on A5 is accompanied by "blocked"; the broken spine on B3 by "stopped".
- **Registration marks mean focused-but-not-editable.** Solid handles appear on
  exactly one surface in the product: the video editor's trim points (V1).
  Preview frames never gain handles.
- **Indeterminate work uses a sweeping cyan segment, never a fake percentage.**
  Percentages appear only once bytes are measurable (A9, C6).
- **Touch targets are 44px minimum** on every mobile scene, including player
  icons that are visually smaller but padded to size.
- **Destructive actions are separated** by a gap or band, never coral-filled,
  and always name what will be lost.

### Copy rules

- **Error language is: what happened, what still works, what to do next.** No
  apology, no blame, no error codes, no mention of permission APIs (A5, B3).
- **File safety is stated before anything else** in any failure state (B3).
- **Status strings are never paraphrased.** The vocabulary is fixed in
  `packages/design-system/src/status.ts` and extended in P1 Task 1.

### Verification infrastructure

`packages/design-system` has Vitest. **`apps/web` and `apps/extension` have
none.** P1 Task 8 and P2 Task 1 add it. Until then, no phase after P1 can
follow a real TDD cycle — this is why P1 must land first even though it ships
no user-visible change.

---

## Known conflicts between the prototypes and shipped P0 code

Resolve these in P1 Task 1. They are not cosmetic.

| # | Conflict | Resolution |
|---|---|---|
| 1 | Prototypes hardcode `#8D989B` as faint-on-light. P0 rejected it at 2.86:1 and shipped `#656E71`. | **Keep `#656E71`.** The contrast suite is the gate; the prototype is wrong. Do not relax the test. |
| 2 | `StatusChip` is 22px tall. The prototype's `StatusBadge` is 19px. | **19px**, and rename. 22px was a P0 guess; the prototype is specific. Update `controls.test.tsx`. |
| 3 | `STATUS_WORDS` holds 9 strings. The capture item model needs 13. | **Extend to 17** — the union of both. See P1 Task 1. |
| 4 | Control heights are 30/34/40/46. The prototypes use 32px throughout the web app top bar and 36px in extension option rows. | **Add `--sr-h-2xs: 32px` and `--sr-h-row: 36px`.** Two additions, documented, then the "no other heights" rule holds again. |
| 5 | `PathSpine` exists but has no `failed` / `offline` tick rendering. | Extend in P1 Task 6. |

---

## Exit criteria per phase

**P1** — `npm test --workspace=packages/design-system` passes with the eight new
components covered. `apps/web` builds. No visual change shipped.

**P2** — Extension loads unpacked, all nine popup states reachable, a real
recording completes through B1→B2→B6 against the dev server, and an airplane-mode
recording queues and drains. `./ship-to-store.sh` produces a valid zip.

**P3** — Every route renders under the new shell at 1440 / 1024 / 768 / 390.
`npm run build:prerender` succeeds. The Shared route is added to `App.tsx`,
`prerender.mjs`, `sitemap.xml`, `_redirects` and `indexnow.yml`.

**P4** — A share link opened logged-out renders C1/C2 correctly; comment
anchoring works at both timecode and point; C5 and C6 render without media.

**P5** — Both editors round-trip a real project: trim, zoom, export. Unsaved-changes
guard fires. The in-page region selector and webcam overlay work in the extension.

**P6** — Landing prerenders with correct meta. Sign-in, guest claim, all three
sign-in failures and session expiry are reachable and recoverable.

---

## Sizing

| Phase | Tasks | Rough size |
|---|---|---|
| P1 | 9 | 8 new components, 1 infra |
| P2 | 11 | popup rewrite + completion surface + queue |
| P3 | 14 | shell + 7 surfaces + responsive |
| P4 | 7 | share page, two anchoring models, mobile |
| P5 | 9 | two editors + two overlays |
| P6 | 8 | landing + 5 auth states |
| **Total** | **58** | |
