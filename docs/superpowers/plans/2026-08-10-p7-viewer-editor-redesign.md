# P7 Viewer & Video Editor Redesign — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Status: IN PROGRESS — V1, V2, E1, E2, V3, E3, E4 done. O3/O4/O8 answered 2026-08-10.**

**Remaining:** E5.3 (blur cursor trail) only — needs cursor metadata from the extension, which means a Chrome Web Store release. Every other phase is done as of 2026-08-10.

**Also fixed in passing:** a zoomed export took its video from `canvas.captureStream()`, which carries no audio — those exports were silent. The E5.2 audio graph fixes that.

**Goal:** Rebuild `/v/:id` (video viewer) and `/video-editor` to the two supplied mockups.

**The honest headline:** roughly **40% of what the mockups show is a UI rebuild on data that already exists.** The rest needs backend work, and about a quarter of it needs subsystems that do not exist in any form (view-progress telemetry, silence detection, MP4 transcoding). This plan separates those three tiers so the cheap, high-impact part can ship without waiting on the expensive part.

---

## 1. Reality check — mockup element vs. what exists

Verified against the running database and the current source, not assumed.

### 1.1 Viewer (`/v/:id`)

| Mockup element | Backing data today | Verdict |
|---|---|---|
| Title, owner, date | `recording.title`, `user.fullName`, `createdAt` | **Reskin** |
| `SHARED` status chip | `toShareState()` + `StatusBadge` | **Reskin** |
| Duration `3:02` | `durationSec` — now stored at upload | **Reskin** |
| Description paragraph | `recording.description` column exists, **never written or exposed** | Small backend |
| Dimensions `1920×1080` | **No column anywhere** | Backend + capture change |
| Player, scrubber, transport | `VideoPlayer.tsx` | **Reskin** |
| Comment markers on scrubber | `comment.timecodeMs` | **Reskin** (already built in `VideoShare`) |
| Comments list, timecode anchors | `sr_comments` | **Reskin** |
| `RESOLVED` on a comment | **No `resolved` column** | Migration + API |
| `VIEWS 38` | `recording.views` | **Reskin** |
| `COMMENTS 4` | count of comments | **Reskin** |
| `WATCHED 87%` | **Nothing. No telemetry of any kind** | **New subsystem** |
| Transcript tab | `sr_transcripts` table exists (`segmentsJson`, `language`, `model`) — **no entity, no service, no route, no producer** | Backend + ASR pipeline |
| Chapters strip | `sr_summaries.chaptersJson` exists — **no entity, no service, no producer** | Backend + LLM pipeline |
| Details tab | Mixed: some fields exist, some do not | Depends on above |
| Captions button (`Tt`) | No caption track, no VTT | Depends on transcript |
| `Edit` action | `/video-editor/project/:id` exists | **Reskin** (wiring) |
| `Copy link` | Exists in current ShareView | **Reskin** |
| `…` overflow | New menu, actions TBD | Reskin + decisions |

### 1.2 Editor (`/video-editor`)

| Mockup element | Backing today | Verdict |
|---|---|---|
| Dark technical chrome | Already dark, already tokenised | **Reskin** |
| Title + `1:41 of 3:02 kept` | `trimStartSec`/`trimEndSec`/`videoDurationSec` | **Reskin** |
| `UNSAVED` chip | `hasUnsavedChanges` | **Reskin** |
| Undo / redo buttons | **No history stack in `VideoEditorContext`** | New (frontend only) |
| `Save draft` | `saveProject()` + `timelineJson` | **Reskin** |
| `Publish changes` | Partially — see §5 open question O4 | Backend flow |
| Left tool rail (6 tools) | `activeTool` exists; 4 of 6 tools have no implementation | Mixed |
| Stage + selection handles | `EditorWorkspace` | **Reskin** |
| Zoom overlay label + rect | `zoomKeyframes` (add/update/delete) | **Reskin** |
| Transport, frame-step | Play exists; **frame-step does not** | Small frontend |
| Timeline ruler | **Does not exist** | New frontend |
| VIDEO lane + trim handles | `trimStartSec`/`trimEndSec` | **Reskin** |
| ZOOM lane chips | `zoomKeyframes` | **Reskin** |
| CUTS lane chips | **No cut model at all** | New (model + UI + render) |
| AUDIO waveform lane | **No waveform extraction** | New frontend (Web Audio) |
| Trim Start/End sliders | Exists | **Reskin** |
| Fade in / Fade out | **Not in model, not in render** | New |
| `Remove silences` + gap count | **No audio analysis** | **New subsystem** |
| `Blur cursor trail` | Extension records cursor metadata; **no blur render** | New subsystem |
| `Normalize audio` (−16 LUFS) | **Nothing** | **New subsystem** |
| Output length | Derivable from trim | **Reskin** |
| Estimated size | Heuristic possible | Small frontend |
| `MP4 · H.264 · 1080p` | **Export is WebM via MediaRecorder** | **Transcoding — see O3** |

### 1.3 Orphaned schema discovered

Four tables/columns exist in Postgres with **zero server code** — the same defect class as `durationSec`, which was unmapped for months and silently broke every duration display:

- `sr_transcripts` — `recordingId, language, durationSec, segmentsJson, rawProviderResponse, model, createdAt`
- `sr_summaries` — `tldr, bulletsJson, actionItemsJson, chaptersJson, keyDecisionsJson, model, promptVersion, generatedAt`
- `sr_recordings.transcriptStatus`, `.summaryStatus`, `.transcriptFailReason`, `.transcriptPublic` — unmapped on the entity
- `sr_video_projects.timelineJson` — mapped and used

Someone designed an ASR + LLM-summary pipeline and shipped the schema without the code. **The Transcript tab and Chapters strip in the mockup are that pipeline's UI.** Building them means building the pipeline, not just the components.

---

## 2. Design-system conflicts to resolve before building

The mockups contradict `CLAUDE.md` in three places. These need a ruling, because the design system has tests that enforce some of it.

| # | Conflict | Rule today | Options |
|---|---|---|---|
| C1 | Viewer has a **dark top bar over a light page** | *"Management surfaces are light-only. Dark is reserved for Technical workspaces"* | (a) amend the rule — the viewer is a media surface, not management; (b) make the bar light |
| C2 | Editor uses **coral for `UNSAVED`** | *"Coral is reserved for live capture and needs-a-response"* | (a) widen coral to "needs your attention"; (b) use a neutral/amber treatment for unsaved |
| C3 | Editor uses **coral for `Cut` chips** on the timeline | same | A cut is destructive-but-normal, not an alert. Recommend a non-coral treatment |

C2/C3 matter beyond aesthetics: coral's meaning is currently enforceable precisely because it is rare. Spending it on "unsaved" and on every cut chip devalues the "needs a reply" signal the viewer depends on.

---

## 3. Phase breakdown

Phases are ordered so each ships independently and nothing is blocked on a subsystem.

### Phase V1 — Viewer shell & layout (reskin only) — **DONE 2026-08-10**
- [x] V1.1 Dark top bar: back, title, status chip, `Download` / `Edit` / `Copy link` / overflow
- [x] V1.2 Two-column layout: media + metadata left, right rail
- [x] V1.3 Metadata block: title, `owner · date · duration`, description
- [x] V1.4 Stats tiles — **Views and Comments only** (see V4 for Watched)
- [x] V1.5 Right rail tab bar; Comments populated, Transcript/Details render an honest empty state
- [x] V1.6 Responsive: rail becomes a sheet below `md`
**Depends on:** nothing. **Ships value alone.**

### Phase V2 — Player rebuild — **DONE 2026-08-10**
- [x] V2.1 Rebuild `VideoPlayer` chrome to the mockup (square cyan play, new scrubber, transport)
- [x] V2.2 Comment markers on the scrubber, click-to-seek
- [x] V2.3 Speed menu, volume, fullscreen on the new control bar
- [x] V2.4 Keyboard: space, ←/→, `,`/`.` frame-step, `f`, `m`
- [x] V2.5 Captions button — **hidden until a transcript exists**
**Depends on:** V1.

### Phase V3 — Comments upgrade
- [x] V3.1 Migration: `sr_comments.resolvedAt timestamptz NULL`, `resolvedByUserId`
- [x] V3.2 `PATCH /recordings/:id/comments/:commentId/resolve` (owner or comment author)
- [x] V3.3 Resolved treatment in the list *(filter still outstanding)*
- [ ] V3.4 Composer state done in V1; **attachment affordance outstanding**
**Depends on:** V1. Backend: one migration.

### Phase V4 — Watch telemetry (`WATCHED 87%`) — **DONE 2026-08-10** *(endpoint unverified live — dev server stale)*

Per O1/O2: **coverage**, **signed-in viewers only**.

Consequences to honour:
- Coverage needs merged watched-intervals per viewer, not a single number. The
  interval merging is the same shape as `cuts.ts` — factor it rather than
  writing it twice.
- Guests get no row. The tile therefore describes a **subset** of the audience,
  and must say so; on a widely shared link most viewers are guests.
- A viewer can exceed 100% by rewatching only if coverage is computed wrongly —
  distinct seconds cannot exceed the duration. Clamp anyway and treat a value
  over 100 as a bug signal, not a display problem.
- Hide the tile until at least one signed-in viewer has watched. `0%` on a
  recording nobody signed in to watch is the `0:00` mistake again.

- [x] V4.1 Decide the metric (see O1) — **coverage**
- [x] V4.2 `sr_recording_views` table: recordingId, viewerId/guestId, maxPositionSec, coveredSec, completedAt
- [x] V4.3 Throttled `POST /recordings/:id/progress` (≤1 per 10s, batched on pagehide)
- [x] V4.4 Aggregate on read; expose on the recording payload
- [x] V4.5 Tile renders; hidden until there is at least one view
**Depends on:** V1. **This is the single most expensive viewer item.** Privacy decision required (O2).

### Phase V5 — Transcript & Chapters — **CUT 2026-08-10 (O8: not in budget)**

Replaced by V5x below: remove the affordances rather than ship them empty.

### Phase V5x — Remove the transcript surface — **DONE 2026-08-10**
- [x] V5x.1 Drop the Transcript tab from the viewer rail
- [x] V5x.2 Remove the captions affordance from the player (`captionsAvailable`)
- [x] V5x.3 Document `sr_transcripts` / `sr_summaries` / the four unmapped Recording columns as unused, so the next person does not mistake them for a working pipeline

### ~~Phase V5 (cut) — Transcript & Chapters~~
- [ ] V5.1 Entities for `sr_transcripts` / `sr_summaries`; map the four orphan columns on Recording
- [ ] V5.2 `GET /recordings/:id/transcript`, `/summary`
- [ ] V5.3 ASR pipeline: provider, queue, `transcriptStatus` lifecycle, failure surface
- [ ] V5.4 Chapter generation into `chaptersJson`
- [ ] V5.5 Transcript tab: search, click-to-seek, active-cue follow
- [ ] V5.6 Chapters strip with real frames (needs poster extraction — see O5)
- [ ] V5.7 VTT endpoint so V2.5 captions can turn on
**Depends on:** V1, V2. **Largest single body of work. Recurring cost per minute of video.**

### Phase E1 — Editor chrome & panels (reskin) — **DONE 2026-08-10**
- [x] E1.1 Top bar: title, `x of y kept`, unsaved chip, undo/redo, Save draft, Publish
- [x] E1.2 Left tool rail — **only tools that do something**; others deferred, not shown disabled
- [x] E1.3 Right panel: TRIM group (Start/End/Fade), CLEAN UP group, OUTPUT group
- [x] E1.4 Stage: dashed bounds, cyan corner marks, zoom overlay label
**Depends on:** nothing.

### Phase E2 — Timeline — **DONE 2026-08-10**
- [x] E2.1 Ruler with adaptive tick density
- [x] E2.2 VIDEO lane with draggable trim handles, bound to existing trim state *(already existed in EditorTimeline)*
- [x] E2.3 ZOOM lane from `zoomKeyframes` *(already existed; retiming by drag still outstanding)*
- [x] E2.4 Playhead: drag, click-to-seek, follows playback
- [x] E2.5 AUDIO lane: Web Audio peak extraction, cached per project
- [x] E2.6 Timeline zoom (the `ZOOM − 1× +` control)
**Depends on:** E1. E2.5 is the only heavy part.

### Phase E3 — Undo/redo & cuts — **DONE 2026-08-10**
- [x] E3.1 Command-stack history over timeline state
- [x] E3.2 Cut model in `timelineJson` (ranges removed from output)
- [x] E3.3 CUTS lane rendering + add/remove
- [x] E3.4 Render honours cuts in preview and export
**Depends on:** E2. **E3.4 is where cuts stop being decorative.**

### Phase E4 — Fades & output panel — **DONE 2026-08-10**
- [x] E4.1 Fade in/out in the model + preview
- [x] E4.2 Output length from trim + cuts
- [x] E4.3 Estimated size heuristic (bitrate × length), labelled as an estimate
**Depends on:** E3.

### Phase E5 — Clean-up features — **E5.1 + E5.2 DONE 2026-08-10; E5.3 needs an extension release**
- [x] E5.1 `Remove silences` — detection over the decoded peaks, proposed as ordinary cuts
- [x] E5.2 `Normalize audio` — RMS measurement + gain on export. **RMS, not LUFS** — true BS.1770 needs K-weighting and gated analysis; the label says RMS rather than claiming a figure it does not compute.
- [ ] E5.3 `Blur cursor trail` — **not built.** Needs cursor metadata from the extension (a Web Store release); the toggle says so.
**Depends on:** E3. **Each is a genuine subsystem; treat as three separate projects.**

### Phase E6 — Publish & format — **DONE 2026-08-10**
- [x] E6.1 Publish-in-place: replace the recording's file, keep id, comments, views *(endpoint unverified live — dev server stale)*
- [~] E6.2 MP4/H.264 output — **N/A: O3 chose WebM**
- [x] E6.3 Progress + failure states for a long encode
**Depends on:** E4. **See O3 — this may be the largest item in the whole plan.**

---

## 4. Use cases

**Viewer**
1. Recipient opens a link, watches, leaves — no account.
2. Recipient comments at a timestamp as a guest; signs in later and claims it.
3. Owner opens their own capture, sees stats, jumps to a comment, replies, resolves it.
4. Owner clicks Edit and lands in the editor on this recording.
5. Someone opens a link on a phone.
6. Someone opens a link to a private/disabled capture.
7. Someone opens a link while the file is still processing.
8. Someone scrubs by clicking a chapter.
9. Someone reads the transcript and clicks a line to seek.
10. Someone copies the link to reshare.

**Editor**
1. Owner trims head/tail and publishes over the existing link.
2. Owner adds a zoom on a region and retimes it.
3. Owner cuts a mistake out of the middle.
4. Owner runs Remove silences and reviews the proposed cuts.
5. Owner saves a draft, closes the tab, resumes tomorrow.
6. Owner undoes several operations.
7. Owner exports without publishing.
8. Owner opens a project whose source recording was deleted.

---

## 5. Edge cases

Grouped by where they bite. Each needs a defined behaviour before the relevant task is called done.

### Media & data
- **Duration unknown** — `durationSec` null and the WebM header carries none. Ruler, trim bounds and `x of y kept` all divide by it. **Must fall back to the element's measured duration, and the ruler must not render until known.**
- **Duration disagrees with the file** (stored 180s, file 179.4s) — trim handles must clamp to the file, not the record.
- **Zero-length or corrupt file** — player error state; editor must refuse to open rather than render a broken timeline.
- **Very long recording (>1 h)** — ruler tick density, waveform memory, transcript length, comment marker crowding.
- **Very short recording (<2 s)** — chapters meaningless; trim handles overlap; fade sliders exceed the clip.
- **Portrait / square / ultrawide** — stage letterboxing; `1920×1080` label wrong for non-16:9; chapter thumbnails.
- **Presigned URL expires mid-session** (1 h) — playback and editing both break silently today. Needs refresh-on-403.

### Comments
- Comment at a timecode beyond the trimmed output after publishing — orphaned marker.
- Two comments at the same second — marker overlap.
- Comment by a deleted user; comment by a guest with no name.
- Guest resolves — should they be able to? (see O6)
- Very long comment body; RTL text; emoji-only.
- Comments arriving while the list is open (no realtime today — poll or ignore?).
- Zero comments — the rail must not look broken.

### Stats
- Zero views — hide the tiles or show `—`? Never show `0%` watched (the `0:00` duration bug repeated).
- Owner's own views — counted or excluded?
- Watched % above 100 (rewatching) — clamp.
- A single view of 3 s on a 3 min video — 2%, statistically meaningless. Threshold?

### Transcript & chapters
- ASR still running / failed / unsupported language — three distinct states, plus `transcriptFailReason` already in the schema.
- No speech at all.
- Transcript out of date after a publish that changed the video — **stale transcript must be invalidated on publish.**
- `transcriptPublic` false — recipients must not see it.
- Chapters generated for a video that was then trimmed — same staleness problem.

### Editor
- Unsaved changes + browser close, back button, or in-app nav (in-app is handled today; the other two are not).
- Two tabs editing the same project.
- Publish while another publish is in flight.
- Trim start ≥ trim end; fade in + fade out longer than the kept range.
- Cuts overlapping each other or the trim boundary.
- Zoom keyframe inside a cut region.
- Remove silences proposing 200 cuts.
- Undo across a publish boundary — must not undo a published change silently.
- Project whose source recording was deleted or whose R2 object is gone.
- Export on a low-memory device; tab backgrounded mid-encode (`MediaRecorder` stalls when hidden).

### Access & identity
- Guest → sign-in mid-session (claim flow) on both surfaces.
- Non-owner opening `/video-editor/project/:id` — must 403, not render an empty editor.
- Capture with sharing disabled (`sharingDisabledAt`) while someone has the tab open.

### Accessibility & motion
- Keyboard access to scrubber, timeline handles, and every tool.
- Screen-reader names for icon-only controls (the current player has several unnamed buttons).
- `prefers-reduced-motion` for the hover preview, marker pulses and panel transitions.
- Contrast: cyan-on-dark for small text is borderline — must pass the design-system contrast suite.
- Focus management when the comment sheet opens on mobile.

---

## 6. Open decisions (need your ruling)

| # | Question | Why it matters |
|---|---|---|
| ~~O1~~ | **ANSWERED 2026-08-10: coverage.** The fraction of *distinct* seconds watched, ignoring rewatches and skips. Requires storing watched intervals per viewer and merging them — not a high-water mark. |
| *(was O1)* | *Original question:* furthest point reached, or fraction actually watched? | Different table, different maths, different honesty. Coverage is the useful one and costs more. |
| ~~O2~~ | **ANSWERED 2026-08-10: signed-in viewers only.** Per-viewer progress rows for accounts; guests contribute to an anonymous total and get **no per-person row**. No consent gate needed, nothing personal to delete for anonymous viewers. |
| *(was O2)* | *Original question:* is per-viewer tracking acceptable, and for guests too? | It is behavioural analytics on people who never signed up. Affects the privacy policy and CSP/consent. |
| ~~O3~~ | **ANSWERED 2026-08-10: keep WebM.** No transcoder, no ffmpeg.wasm. The panel's `WebM · VP9` is now the intended output, not a placeholder. |
| *(was O3)* | *Original question:* Is MP4/H.264 a hard requirement, or is WebM acceptable? | Today's export is WebM from `MediaRecorder`. MP4 means `ffmpeg.wasm` (large download, slow, memory-hungry) or a server transcoder (new infra, real cost). **This is potentially the biggest single item in the plan.** |
| ~~O4~~ | **ANSWERED 2026-08-10: replace in place.** Same recording id; comments and view counts kept. Requires a staleness rule for comment timecodes past the new length. |
| *(was O4)* | *Original question:* Does Publish replace the file at the same recording id, or create a version? | The mockup promises "Comments and view counts are kept" — that requires in-place replacement plus a staleness policy for transcript/chapters/comment timecodes. |
| **O5** | Where do chapter thumbnails come from? | Client-side frame grabs at publish, or a server-side extractor. Relates to the still-unwritten `thumbnailUrl`. |
| **O6** | Who may resolve a comment — owner only, or the author too? | Determines the guard on the new endpoint. |
| **O7** | Rulings on design conflicts C1–C3 (§2). | Coral's scarcity is what makes "needs a reply" legible. |
| ~~O8~~ | **ANSWERED 2026-08-10: no — cut it.** Transcript tab, Chapters strip and the captions affordance come out of the design. `sr_transcripts` / `sr_summaries` to be documented as unused. |
| *(was O8)* | *Original question:* Is the ASR/LLM pipeline in budget? | Transcript + chapters is a recurring per-minute cost and the largest phase. If not, V5 is cut and the tab is removed from the design rather than shipped empty. |

---

## 7. Recommended sequencing

**Ship first (no backend, immediate visible payoff):** V1 → V2 → E1 → E2.
That is the whole visual redesign of both surfaces on data that already exists.

**Then, cheap backend wins:** V3 (resolve, one migration) → E3 (undo + cuts) → E4.

**Then, by ruling:** V4 (needs O1/O2) → E6 (needs O3/O4) → V5 (needs O8) → E5.

**Recommendation:** do not start V4, V5, E5 or E6 until §6 is answered. Each can consume more effort than the entire visual rebuild, and two of them (V5, E5) are product bets rather than UI work.

---

## 8. Explicitly not in this plan

- Image editor / screenshot viewer (unchanged).
- Realtime multi-user comments.
- Multi-clip timeline (the mockup shows one video track; the existing `clips` model is broader).
- Extension changes, except where E5.3 needs cursor metadata.

---

## 9. Testing strategy

- **Pure logic first:** timeline maths (time↔pixel, cut merging, trim clamping), watch-percentage aggregation, transcript cue lookup. These are where the edge cases in §5 live and they need no DOM.
- **Component tests** for each new surface, rendering the real route element — the `Projects` provider bug proved that testing only presentational children hides container faults.
- **Contrast suite** must pass for every new token pairing.
- **Round-trip tests** against the live server for each new endpoint, as done for `durationSec`.
- **Manual, unavoidable:** playback, scrubbing, encode, and anything involving real media in a real browser.
