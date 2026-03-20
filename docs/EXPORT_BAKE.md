# Baked export (FFmpeg) — zoom + frame

Server-side export should take the **source video** plus **`timelineJson`** and produce a single MP4/WebM.

## Inputs

- Video file (trimmed range already applied to file **or** use `-ss` / `-to` from `trimStart` / `trimEnd`).
- `timelineJson.zoomSegments[]`: `startSec`, `endSec`, `peakScale`, `focusX`, `focusY` (normalized 0–1).
- `timelineJson.frameStyle`: `paddingPct`, `radiusPx`, `aspect`, background (preset or image URL), `shadow` (optional in v1).

## Zoom (zoompan)

Per segment, map focus to crop center. For segment scale \(z = \texttt{peakScale}\):

1. Crop width \(W/z\) × height \(H/z\) centered at \((focusX \cdot W,\, focusY \cdot H)\), clamped to frame.
2. Scale crop back to output size, or use `zoompan` with interpolated `z` and `x`/`y` for ease in/out.

Example filter sketch (single segment; production needs **concat** or **expr** across time):

```bash
# Pseudocode — one segment [start,end], scale 1.65, focus (0.5, 0.5)
ffmpeg -i input.webm -vf "
  zoompan=z='if(between(on,START_F,END_F),1.65,1)':
  x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30
" -c:v libx264 -crf 20 out.mp4
```

Use `enable='between(t,START,END)'` with multiple chained `zoompan` is non-trivial; prefer **precomputed** pan/zoom keyframes or **segment-wise** encode + concat.

## Frame (Phase 5 scope)

- **Padding + solid/gradient background**: `scale` video to inner box, then `pad` to output with color/gradient.
- **Rounded corners**: `geq` mask, or export square then overlay rounded mask; simpler v1: **rectangular pad** only.
- **Custom background image**: `movie=bg.png` under scaled video.
- **Heavy**: full rounded + shadow matches preview only with a complex filter or GPU compositor.

## Client fallback

Short clips: draw to canvas (zoom + letterbox) and `MediaRecorder` — CPU-heavy; cap duration in UI.

## Order of operations

1. Trim (if not baked into file).
2. Zoom segments (time-varying crop/scale).
3. Pad + background + optional round mask.

Stabilize **zoom segment times** (Phase 1–2) before shipping server bake.
