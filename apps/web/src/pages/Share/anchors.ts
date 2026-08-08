/** Two anchoring models, deliberately not unified.
 *
 * A video comment attaches to a moment; an image comment attaches to a place.
 * Collapsing them into one shape with nullable fields would make every call
 * site ask "which kind is this?" anyway, and would let a video comment carry
 * meaningless coordinates. */

export interface TimecodeAnchor { kind: 'timecode'; ms: number }
export interface PointAnchor { kind: 'point'; x: number; y: number }
export type Anchor = TimecodeAnchor | PointAnchor;

export interface ShareComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  anchor: Anchor;
  needsReply: boolean;
  resolved: boolean;
  index: number;
}

/** Minimum horizontal separation before two columns are treated as colliding. */
const COLLISION_PCT = 8;

export interface ColumnPosition {
  id: string;
  leftPct: number;
  columnIndex: number;
}

/** Each column starts at its timecode's horizontal position under the media, so
 * the conversation is legible as a shape before it is read.
 *
 * Comments close together in time get stacked column indices rather than
 * overlapping — two notes at 0:10 and 0:10.4 are about different things. */
export function columnPositions(comments: ShareComment[], durationMs: number): ColumnPosition[] {
  const timed = comments
    .filter((c): c is ShareComment & { anchor: TimecodeAnchor } => c.anchor.kind === 'timecode')
    .sort((a, b) => a.anchor.ms - b.anchor.ms);

  const placed: ColumnPosition[] = [];

  for (const comment of timed) {
    const leftPct = durationMs === 0
      ? 0
      : Math.min(100, Math.max(0, (comment.anchor.ms / durationMs) * 100));

    const taken = new Set(
      placed
        .filter(p => Math.abs(p.leftPct - leftPct) < COLLISION_PCT)
        .map(p => p.columnIndex),
    );

    let columnIndex = 0;
    while (taken.has(columnIndex)) columnIndex += 1;

    placed.push({ id: comment.id, leftPct, columnIndex });
  }

  return placed;
}

/** Leaders are drawn only when the margin is at least 300px wide. Below that —
 * tablet portrait and mobile — they are dropped entirely and selection
 * replaces connection. */
export function leadersVisible(marginPx: number): boolean {
  return marginPx >= 300;
}

export function pinScreenPosition(anchor: PointAnchor, box: { w: number; h: number }) {
  return { left: anchor.x * box.w, top: anchor.y * box.h };
}

/** Numbers make pins distinguishable without colour, so they must never have
 * gaps. Renumber on every change rather than storing an index. */
export function renumber(comments: ShareComment[]): ShareComment[] {
  return comments.map((comment, i) => ({ ...comment, index: i + 1 }));
}

/** mm:ss for a timecode marker's accessible name.
 *
 * FLOORS, matching the video editor: at 11.6s you are still inside the 11th
 * second, and the same moment must render identically on both surfaces or a
 * comment marker and a trim handle disagree about where they are. */
export function formatTimecode(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
