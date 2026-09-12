# Design: Streaming Upload

**Status:** approved
**Date:** 2026-09-13
**Replaces:** the single presigned `PutObject` in `StorageService.getUploadPresignedUrl`
as the transport for recordings.

## Problem

A recording is uploaded only if the user asks for it, only after it has fully
finished, and only as one enormous PUT.

```
record fully into memory → stop → hand the whole blob to /v
                                → user clicks "Create share link" (sign-in required)
                                → ONE presigned PUT of the entire file
```

Four consequences, all of them felt:

1. **Nothing is saved until the user acts.** If they close the tab, never click,
   or are signed out, the capture exists nowhere. This is the original report —
   *"I make more than 1 hr recording, but I cannot find the file. No history. No
   folder. Where did it go?"*
2. **No resume.** A 742 MB PUT that fails at 95% starts again from zero.
   `apps/extension/background/storage.js` says as much in a comment: *"R2
   presigned PUTs do not support ranged resume, so a retry re-sends the whole
   blob."*
3. **The share link is slow.** The upload cannot begin until recording ends, so
   the user waits out the whole transfer before they have anything to send.
4. **A local file became the workaround.** Writing every capture to Downloads
   was the only way to stop the data loss without touching the backend. It
   treats the symptom, and it fills the user's folder with files they never
   asked for.

`MediaRecorder` already emits a chunk every second (`mediaRecorder.start(1000)`,
`apps/extension/offscreen/offscreen.js`). Half of a streaming upload is already
running; nothing consumes it.

## Goals

- **G1.** A recording is on R2 before the user stops recording, without the user
  asking.
- **G2.** A share link is available within seconds of stopping, not after a
  full-length upload.
- **G3.** A failed part retries by itself and costs one part, not the recording.
- **G4.** The capture appears in `/library` automatically — the "no history"
  half of the original report.
- **G5.** Incomplete uploads never accumulate billed storage.

## Non-goals

- Screenshots. They are small, cheap to retake, and the existing single PUT is
  adequate. This is about recordings.
- Removing the Downloads fallback. It is now armed only when the handoff is
  never acknowledged, and stays as the last resort.
- Changing the editors, the share page, or the claim flow beyond what a
  server-side recording requires.
- Live streaming to viewers. The recording is uploaded as it is made; it is not
  watchable until it is complete.

## Design

### D1 — Multipart upload, driven from the service worker

```
offscreen (MediaRecorder)      background (service worker)       server / R2
─────────────────────────────────────────────────────────────────────────────
                               POST /recordings/upload/begin ──> CreateMultipartUpload
                                 (once, at recording start)       → uploadId
chunk every 1s
  └─ buffer until ≥ 5 MB
       └─ "part 3 ready" ─────> POST /recordings/upload/part ──> presigned UploadPart URL
       <─── signed URL ────────  (a string, not bytes)
  PUT the part straight to R2 ────────────────────────────────> stored → ETag
       └─ "part 3 done, ETag" > records the ETag
  stop
  └─ final part, same path
                               POST /recordings/upload/complete > CompleteMultipartUpload
                               POST /recordings (metadata) ────> row in the database
```

**The bytes never cross IPC.** The offscreen document holds the chunks and
performs the PUT itself; the service worker only orchestrates — it asks the
server for a signed URL, passes that *string* to the offscreen document, and
records the ETag that comes back. This is the same lesson as the recording
handoff: anything that marshals megabytes through `chrome.runtime` fails at
size. It is also why A5 is checkable.

Parts are at least **5 MB**, R2's minimum for every part except the last. At the
recorder's default ~2.5 Mbps that is a part roughly every 16 seconds.

Media still never transits the NestJS server: it signs each part and the
extension PUTs directly to R2, exactly as the current single-shot upload does.

### D2 — Upload continuously, without throttling

Parts go up as they fill, for the whole recording. On a weak connection this
competes with whatever the user is recording. That trade is accepted
deliberately: the alternative gives up G1 and G2, which are the point.

### D3 — Everyone uploads; guest recordings expire

Guests stream-upload on the same path as signed-in users, so no capture is ever
stranded. A guest recording is deleted after **48 hours** unless claimed, which
caps the cost of anonymous use without making the guest experience second-class.
This figure is a starting value, not a measured one — it is the cheapest number
to change once there is real usage data, and it should be revisited as soon as
there is any.

`POST /recordings/claim` already transfers guest-owned recordings on sign-in;
claiming clears the expiry. The recordings table gains:

```
expiresAt  timestamptz NULL   -- set for guest uploads, cleared on claim
```

A daily job deletes rows past `expiresAt` and their R2 objects. The guest must
be told: the share page states when an unclaimed recording expires and what
signing in does about it.

**Build order matters here.** Guest streaming must stay switched off until the
expiry job exists and is verified. Shipping "everyone uploads" without the thing
that bounds it is how storage cost becomes unbounded, and it would be invisible
until a bill arrives.

### D4 — Orphan cleanup: abort on cancel, plus a 1-day lifecycle rule

Parts are billed storage from the moment they land, and stay billed — and
invisible in the bucket listing — until the upload is completed or aborted. An
upload that is never finished is an orphan.

Two mechanisms, covering different failures:

- **Abort on cancel.** `POST /recordings/upload/abort` issues
  `AbortMultipartUpload`. The extension calls it when the user cancels a
  recording, and on `chrome.runtime.onSuspend`. Immediate and precise, but only
  works while the extension is alive.
- **A 1-day bucket lifecycle rule.** R2 expires incomplete multipart uploads
  after 24 hours. This is the backstop for crashes, closed browsers and dead
  networks, where nothing of ours is left running to call abort.

**The lifecycle rule is configuration, not code.** It must be set on the R2
bucket by hand and is the single easiest part of this design to forget and then
discover on a bill. It is called out again in the implementation plan's release
section for that reason.

**Constraint the 1-day window imposes:** a stalled upload must resume within 24
hours or its parts are gone. The retry backoff in
`apps/extension/background/queue.core.js` caps at 15 minutes, well inside that,
but any future "resume tomorrow" feature would need the window widened first.

### D5 — Retry belongs in the existing queue

`background/queue.core.js` — pure reducers, already tested, and with **no
callers** — was written for exactly this and never wired up. A failed part
becomes a queue item retried with its existing exponential backoff, capped at 15
minutes. Only the failed part is re-sent; parts already accepted by R2 keep
their ETags.

### D6 — The share link stops waiting for the upload

When the last part completes, the extension posts the metadata and has a
recording id immediately. `/v/:id` therefore opens on a real, server-side
recording instead of a local blob waiting to be uploaded, which is what makes G2
and G4 true.

The existing local-blob path on `/v` stays: it is what a guest with a failed
upload, or an extension that has not updated, still falls back to.

## Acceptance criteria

- **A1.** A 30-minute recording is fully on R2 within seconds of pressing stop.
- **A2.** Killing the network for 60 seconds mid-recording loses no data: the
  affected parts retry and the recording completes.
- **A3.** A recording never explicitly uploaded by the user still appears in
  `/library`.
- **A4.** Cancelling a recording leaves no incomplete multipart upload —
  `ListMultipartUploads` returns nothing for it.
- **A5.** No `SNAPREC` message carries more than 1 MB; media reaches R2 only by
  direct PUT from the extension.
- **A6.** A guest recording carries an `expiresAt`; signing in and claiming it
  clears it.
- **A7.** Nothing is written to the Downloads folder on the happy path.

## Risks

- **Cost of anonymous use.** Every guest recording is stored for up to 48 hours,
  including abandoned ones. The expiry job is what bounds this; if it fails,
  cost grows silently. It needs monitoring, not just writing.
- **Upstream contention.** Uploading while recording can degrade the call or
  demo being recorded on a slow connection. Accepted per D2, but it is the most
  likely source of "the recording is choppy" reports.
- **The lifecycle rule is manual.** If it is never applied, D4 is half-built and
  orphans accumulate invisibly.
- **Partial recordings.** A recording interrupted mid-way now has real parts on
  R2. The design treats an incomplete upload as nothing — it is aborted, not
  salvaged into a truncated video.
