import type { Recording } from '../../hooks/useRecordings';
import type { Anchor, ShareComment } from './anchors';
import type { ShareState } from './ShareShell';

/** Server comment shape after the anchor migration. The three anchor fields
 * are optional because every row written before it has none. */
type ServerComment = Recording['comments'][number] & {
  timecodeMs?: number | null;
  anchorX?: number | null;
  anchorY?: number | null;
};

type ServerRecording = Recording & {
  isPublic?: boolean;
  sharingDisabledAt?: string | null;
};

/** Maps the server row onto one of three share states.
 *
 * `isPublic` absent means public: that is what every recording uploaded before
 * the column existed actually is, and treating them as private would hide
 * links that currently work. */
export function toShareState(recording: ServerRecording): ShareState {
  if (recording.sharingDisabledAt) return 'private';
  if (recording.isPublic === false) return 'private';
  if (recording.isReady === false) return 'processing';
  return 'ready';
}

function anchorOf(comment: ServerComment): Anchor {
  if (comment.anchorX != null && comment.anchorY != null) {
    return { kind: 'point', x: comment.anchorX, y: comment.anchorY };
  }
  // Comments written before the anchor columns existed render at 0:00 rather
  // than being dropped — an un-anchored comment is still a comment.
  return { kind: 'timecode', ms: comment.timecodeMs ?? 0 };
}

/** Chronological, numbered, with exactly one comment marked as owed.
 *
 * Only the *newest* non-owner comment needs a reply. Marking every unanswered
 * comment would put four coral bars on a four-message thread and make the
 * signal useless. */
export function toShareComments(
  recording: ServerRecording,
  ownerSupabaseId: string | undefined,
): ShareComment[] {
  const sorted = [...(recording.comments ?? [])]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)) as ServerComment[];

  const newest = sorted.at(-1);
  const owed = Boolean(
    ownerSupabaseId && newest && newest.user?.supabaseId !== ownerSupabaseId,
  );

  return sorted.map((comment, i) => ({
    id: comment.id,
    author: comment.user?.fullName ?? 'Guest',
    body: comment.content,
    createdAt: comment.createdAt,
    anchor: anchorOf(comment),
    needsReply: owed && comment.id === newest?.id,
    resolved: false,
    index: i + 1,
  }));
}

export function toShareKind(recording: Recording): 'recording' | 'screenshot' {
  return recording.type === 'video' ? 'recording' : 'screenshot';
}
