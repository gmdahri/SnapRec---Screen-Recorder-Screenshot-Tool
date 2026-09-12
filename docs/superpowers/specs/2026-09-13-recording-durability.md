# Spec: Recording Durability

**Status:** approved
**Date:** 2026-09-13
**Origin:** Customer report — *"I use extension and make more than 1 hr recording, but I cannot find the file. No history. No folder. Where did it go?"*

## Problem

A finished recording exists as exactly one in-memory `Blob` inside the offscreen
document (`offscreen/offscreen.js:315`). It is never written to disk and never
reaches the server unless the user manually clicks "Upload and get link" on the
`/v` page while signed in. The one mechanism that moves it out of that single
copy — the chunked handoff in `background/background.js:1101-1235` — cannot
finish within its own 60-second kill timer for any large recording.

### Confirmed failure chain

1. **The handoff cannot finish in time.** The blob is moved to the web page in
   512 KB chunks. Each chunk crosses Chrome IPC twice as a plain JS array of
   524,288 boxed numbers — `Array.from(uint8Array)` at `offscreen.js:110`, then
   again as `executeScript` args at `background.js:1155`.

   | | |
   |---|---|
   | 1 hr @ Chrome's default ~2.5 Mbps VP9 | 1.13 GB |
   | Chunks required | 2,146 |
   | Measured per-chunk cost (in-process `structuredClone`, **lower bound**) | 43.5 ms |
   | Best-case total | ~1.6 min |
   | `safetyTimeout` (`background.js:1086`) | **60 s** |

   The 43.5 ms figure is a floor measured in one Node process. Real Chrome
   crosses three processes per hop, so expect several minutes.

2. **The timer destroys the only copy.** `safetyTimeout` fires
   `finalizeCleanup()` → `closeOffscreenDocument()`, discarding
   `currentRecordingBlob`.

3. **The retry is unreachable.** The catch block at `background.js:1225` waits
   for `chrome.tabs.onUpdated` with `status === 'complete'` to fire again. It
   already fired and will not fire again for that navigation, so `MAX_RETRIES = 5`
   is dead and the real attempt count is 1.

4. **A second, independent reaper.** `stopRecording()` calls `cleanupTracks()`
   at `offscreen.js:332` *before* the handoff. Once the media tracks stop, the
   offscreen document no longer satisfies the `DISPLAY_MEDIA`/`USER_MEDIA`
   reason keeping it alive, so Chrome may reap it mid-transfer regardless.

5. **No disk fallback exists.** `downloads` is in the manifest, but the only
   `chrome.downloads.download` call (`background.js:725`) is the *screenshot*
   editor fallback. No video path ever writes a file.

6. **No history exists.** Three separate dead paths:
   - `captureFinished` — the message that drives the popup's completion view
     (`popup/state.js:214`) — has **zero senders**.
   - `queueCapture()` (`background.js:1414`) has **zero callers**, so the
     offline upload queue never runs and `uploadQueued`/`uploadSaved` are
     never sent.
   - `uploadCapture` and `cancelUpload`, sent by the popup at
     `popup/popup.js:124-131`, have **no receiver** in `background/`.
   - `/library` is server-side only; nothing reaches the API without a manual
     click.

7. **A wall-clock TTL shorter than a session.** `ShareView.tsx:119` clears the
   IndexedDB copy after 1 hour, measured from injection. A user who records for
   an hour and returns finds `store.clear()` has already run.

## Goals

- **G1.** A finished recording is on the user's disk before any other
  post-recording work begins. This must hold even if the preview tab, the
  handoff, the network, and the server all fail.
- **G2.** The handoff to `/v` completes in constant time regardless of recording
  size — no byte marshalling through IPC.
- **G3.** The offscreen document is never closed while it holds the only copy.
- **G4.** The popup tells the user where the file went.

## Non-goals

- Wiring the full popup upload/library flow (`uploadCapture`, `cancelUpload`,
  `save-library`, `annotate`, the `queueCapture` drain). That is a separate
  subsystem and gets its own spec and plan.
- Changing recording bitrate, codec, or resolution.
- Server-side or `/library` changes.
- Recovering recordings already lost. They are unrecoverable.

## Design

### D1 — Save to disk first (G1)

`handleRecordingComplete()` begins by asking the offscreen document for a
`blob:` URL and handing it to `chrome.downloads.download` with `saveAs: false`
and a `SnapRec/` filename prefix, which makes Chrome create a real folder under
Downloads. The download's completion is awaited before anything else runs, so
the offscreen document is provably alive for the whole disk write.

### D2 — Hand off by reference, not by bytes (G2, G3)

The offscreen document writes the blob into **extension-origin** IndexedDB
(`SnapRecDB`), which it already has code for at `offscreen.js:355`. The
background then injects a hidden iframe pointing at a new extension page,
`handoff/handoff.html`, into the `/v` tab. That page is same-origin with the
offscreen document, reads the blob, and `postMessage`s it to its parent.

A `Blob` crosses `postMessage` **by reference** — the bytes are not copied — so
transfer cost is independent of size. Because the blob now lives in IndexedDB
rather than in a document's memory, the offscreen document can be closed
immediately, and `safetyTimeout`, `CHUNK_SIZE`, and the dead retry machinery are
deleted outright.

### D3 — Tolerant reader on the web (G2)

`ShareView` must accept the new `blob` message shape **and keep accepting the
old `fromIDB` shape indefinitely** — extension updates roll out over days and
users on v2.0.6 and earlier keep sending the old shape. It must also reject
`SNAPREC_VIDEO_DATA` messages that do not originate from a `chrome-extension://`
origin; today it accepts them from any origin, so any page or iframe can inject
a video into the share view.

### D4 — TTL that outlives a session (G1)

The `/v` IndexedDB copy expires after 24 hours rather than 1.

### D5 — Say where the file went (G4)

`handleRecordingComplete` sends `captureFinished` with the saved filename and
byte count, moving the popup into its existing completion view, which names the
file.

## Acceptance criteria

- **A1.** A ≥1 hour recording produces a playable `.webm` under
  `~/Downloads/SnapRec/` with no user interaction.
- **A2.** With the network disabled and the user signed out, A1 still holds.
- **A3.** The `/v` tab plays a ≥1 hour recording, and the time from stop to
  playable is within a few seconds of that for a 10-second recording.
- **A4.** A `SNAPREC_VIDEO_DATA` message from a non-extension origin is ignored.
- **A5.** An extension at the previous release still hands off successfully to
  the updated web app.
- **A6.** After stopping, the popup shows the completion view naming the saved
  file.
