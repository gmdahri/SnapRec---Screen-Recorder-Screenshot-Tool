# Unused database schema

Tables and columns that exist in Postgres but which **no application code reads
or writes**. They are recorded here because the last time this went undocumented
it cost a real bug: `sr_recordings.durationSec` sat unmapped for months while
the web app asked for a `duration` field that could never arrive, so every
capture displayed a blank or `0:00` length. Finding schema and assuming a
feature exists behind it is the trap this file is meant to close.

Last audited: **2026-08-10**.

---

## Stranded by the transcription decision (plan P7, O8)

Transcription and AI summaries were designed and their schema shipped, but the
pipeline was never built. In August 2026 the feature was **cut** rather than
completed, and the UI that would have surfaced it (a Transcript tab in the
viewer, a Chapters strip, and the player's captions control) was removed.

Nothing below is mapped to a TypeORM entity. There is no service, no route, and
no producer.

| Object | Columns | Intended purpose |
|---|---|---|
| `sr_transcripts` | `id, recordingId, language, durationSec, segmentsJson, rawProviderResponse, model, createdAt` | ASR output, one row per recording |
| `sr_summaries` | `id, recordingId, tldr, bulletsJson, actionItemsJson, chaptersJson, keyDecisionsJson, model, promptVersion, generatedAt` | LLM summary; `chaptersJson` was to drive the Chapters strip |
| `sr_recordings.transcriptStatus` | varchar | Job state for the ASR pipeline |
| `sr_recordings.summaryStatus` | varchar | Job state for the summary pipeline |
| `sr_recordings.transcriptFailReason` | varchar | Why an ASR job failed |
| `sr_recordings.transcriptPublic` | boolean | Whether recipients could see the transcript |

**If you are reviving this:** the schema is a reasonable starting point, but
treat it as a design sketch rather than a contract — it was written before any
provider was chosen, and `rawProviderResponse` in particular assumes one that
returns a single JSON blob.

**If you are cleaning up:** these are safe to drop. Confirm first that no
Supabase view, RLS policy, or external job references them; this codebase does
not.

---

## Notes on things that are *not* in this file

- `sr_recordings.durationSec` **is now mapped and written** (P7, August 2026).
  It was the original example of this problem and is no longer stranded.
- `sr_recordings.thumbnailUrl` is mapped and accepted by `CreateRecordingDto`,
  but **`RecordingsService.create` never copies it**, so a client that sends one
  silently loses it. That is a live bug rather than unused schema, and it is not
  fixed here — video thumbnails are currently produced client-side from the
  video element instead.
- `sr_video_projects.timelineJson` is fully used: trim, playback rate, cuts and
  fades are all persisted in it.
