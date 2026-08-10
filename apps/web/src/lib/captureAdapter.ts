import type { CaptureStatus } from '@snaprec/design-system';
import type { Recording } from '../hooks/useRecordings';

/** Maps the server's `Recording` onto the design system's capture model.
 *
 * The server carries `type` and `isReady`; the plate needs one of thirteen
 * states. Every surface reads CAPTURE_STATES, so this is the single place the
 * translation happens — a page that infers status from `isReady` itself is a
 * page that will disagree with the others.
 *
 * The server does not yet distinguish uploading / queued / failed for
 * already-persisted rows: those states exist only in the extension, which owns
 * the upload. When the server grows an upload-state column, extend this and
 * the tests will show which surfaces care. */

export type CaptureKind = 'recording' | 'screenshot' | 'fullpage';

export function toCaptureKind(recording: Recording): CaptureKind {
  return recording.type === 'video' ? 'recording' : 'screenshot';
}

/** Where opening a capture should land.
 *
 * A screenshot opens in the annotation editor, which loads it by id — see
 * `useEditorLifecycle`, which reads the `:id` param and sets the canvas from
 * `recording.fileUrl`. A recording opens in the viewer.
 *
 * Comment threads exist only in the viewer, so the "open and reply" actions on
 * Home, Analytics and Shared deliberately do not use this: sending someone who
 * came to answer a question into a canvas would leave the reply nowhere to go. */
export function captureHref(kind: CaptureKind, id: string): string {
  return kind === 'screenshot' ? `/editor/${id}` : `/v/${id}`;
}

/** The image to show in a capture's preview frame.
 *
 * `thumbnailUrl` is declared on the entity and accepted by the create DTO, but
 * nothing has ever written one — neither the extension's upload nor the
 * editor's save sends the field. Gating the preview on it therefore left every
 * plate an empty black frame.
 *
 * A screenshot needs no separate thumbnail: its own file is the image, and the
 * list endpoint already hands back a presigned, absolute URL. A recording has
 * no still to show until poster frames are generated, so it stays undefined
 * and the plate keeps its empty treatment rather than trying to load a video
 * into an <img>. */
export function capturePreviewUrl(recording: Recording): string | undefined {
  if (recording.thumbnailUrl) return recording.thumbnailUrl;
  return toCaptureKind(recording) === 'screenshot' ? recording.fileUrl : undefined;
}

export function toCaptureStatus(recording: Recording): CaptureStatus {
  // `isReady` is absent on older rows. Defaulting to processing would strand
  // them behind a spinner that never resolves.
  if (recording.isReady === false) return 'processing';

  const handedOut = recording.views > 0 || (recording.comments?.length ?? 0) > 0;
  return handedOut ? 'shared' : 'ready';
}

/** True when the newest comment came from someone other than the owner.
 *
 * This is what drives the coral "needs a reply" band on Home — an unanswered
 * question is the one thing on this product that is genuinely owed. */
export function needsAttention(recording: Recording, ownerSupabaseId: string | undefined): boolean {
  // An endpoint that loads no `comments` relation leaves the key undefined
  // rather than empty, so this reads defensively: a capture we cannot prove is
  // owed a reply is not flagged as one.
  if (!ownerSupabaseId || !recording.comments?.length) return false;

  const newest = [...recording.comments]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .at(-1);

  if (!newest) return false;
  return newest.user?.supabaseId !== ownerSupabaseId;
}

/** Bytes are not returned by the list endpoint, so size is rendered as an
 * em dash rather than a fabricated zero. */
export function formatMeta(recording: Recording): string {
  const kind = toCaptureKind(recording) === 'recording' ? 'recording' : 'screenshot';
  const when = new Date(recording.createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
  return `${kind} · ${when}`;
}

export function formatDuration(seconds: number | undefined): string | undefined {
  if (seconds == null) return undefined;
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}
