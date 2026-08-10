import { type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { CaptureFrame, StatusBadge } from '@snaprec/design-system';
import { columnPositions, formatTimecode, type ShareComment } from './anchors';
import { CommentComposer, type NewComment } from './CommentComposer';

export interface ShareCapture {
  id: string;
  title: string;
  owner: string;
  durationMs: number;
  allowDownload: boolean;
}

export interface VideoShareProps {
  capture: ShareCapture;
  comments: ShareComment[];
  currentMs?: number;
  onSeek: (ms: number) => void;
  /** Returns `false` when the comment is refused — the sign-in gate does
   * that, and the composer then keeps the draft. */
  onPost: (comment: NewComment) => void | boolean;
  player?: ReactNode;
  onDownload?: () => void;
}

/** C1 — time is the anchor.
 *
 * Video comments attach to timecodes, never to spatial pins. Each column
 * starts at its timecode's horizontal position under the media, so the
 * conversation is legible as a shape before it is read.
 *
 * Media dominates: a 52px bar and a 72px metadata margin. No sidebar, no
 * cards, and no promotion — this is the product's front door for people who
 * have never heard of it, and an upsell is the wrong first impression. */
export function VideoShare({
  capture, comments, currentMs = 0, onSeek, onPost, player, onDownload,
}: VideoShareProps) {
  const positions = columnPositions(comments, capture.durationMs);
  const byId = new Map(positions.map(p => [p.id, p]));
  const maxColumn = Math.max(0, ...positions.map(p => p.columnIndex));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--sr-surface-panel-light)' }}>
      <header style={{
        height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 22px', background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 14, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{capture.title}</span>
          {/* An unknown length is omitted rather than shown as 0:00. Not every
              recording has a stored duration, and "0:00" beside a clip that is
              plainly playing reads as a broken file. */}
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{capture.owner}{capture.durationMs > 0 ? ` · ${formatTimecode(capture.durationMs)}` : ''}</span>
        </span>

        {capture.allowDownload && (
          <button type="button" onClick={onDownload} aria-label="Download" style={headerAction}>
            <Icon icon="ant-design:download-outlined" width={14} aria-hidden="true" />
            Download
          </button>
        )}
      </header>

      <div style={{ padding: '22px 22px 40px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Passive frame: two registration marks, no handles. Nothing here is
            resizable, so nothing should look like it is. */}
        <CaptureFrame
          treatment="focused"
          style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9', width: '100%' }}
        >
          {player}
        </CaptureFrame>

        {/* The timeline. Each marker is a real button, not a decoration. */}
        <div style={{
          position: 'relative', height: 26, marginTop: 2,
          borderTop: '1px solid var(--sr-border-light)',
        }}>
          {comments.map(comment => {
            if (comment.anchor.kind !== 'timecode') return null;
            const pos = byId.get(comment.id);
            if (!pos) return null;

            return (
              <button
                key={comment.id}
                type="button"
                aria-label={`Comment at ${formatTimecode(comment.anchor.ms)}`}
                onClick={() => onSeek((comment.anchor as { ms: number }).ms)}
                style={{
                  position: 'absolute', top: 0, left: `${pos.leftPct}%`,
                  width: 2, height: 12, padding: 0, border: 'none',
                  transform: 'translateX(-1px)', cursor: 'pointer',
                  background: comment.needsReply ? 'var(--sr-coral-text)' : 'var(--sr-cyan)',
                }}
              />
            );
          })}
        </div>

        {/* Comment columns, positioned on the time axis. */}
        <div
          data-testid="comment-columns"
          style={{
            position: 'relative',
            minHeight: (maxColumn + 1) * 92,
            marginBottom: 20,
          }}
        >
          {comments.map(comment => {
            const pos = byId.get(comment.id);
            if (!pos) return null;

            return (
              <button
                key={comment.id}
                type="button"
                aria-label={`Comment ${comment.index} from ${comment.author}${comment.needsReply ? ', needs a reply' : ''}`}
                onClick={() => onSeek((comment.anchor as { ms: number }).ms)}
                style={{
                  position: 'absolute',
                  left: `min(${pos.leftPct}%, calc(100% - 220px))`,
                  top: pos.columnIndex * 92,
                  width: 210,
                  textAlign: 'left',
                  background: 'var(--sr-surface-paper)',
                  border: '1px solid var(--sr-border-light-soft)',
                  borderLeft: comment.needsReply
                    ? '2px solid var(--sr-coral-text)'
                    : '1px solid var(--sr-border-light-soft)',
                  padding: '9px 11px',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <span style={{
                  fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                  color: 'var(--sr-cyan-on-light)',
                }}>
                  {comment.anchor.kind === 'timecode' ? formatTimecode(comment.anchor.ms) : ''}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{comment.author}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--sr-text-muted-on-light)' }}>
                  {comment.body}
                </span>
                {comment.needsReply && <StatusBadge status="needs a reply" />}
              </button>
            );
          })}
        </div>

        <div style={{ maxWidth: 520 }}>
          <CommentComposer
            onPost={onPost}
            timecodeMs={currentMs}
            anchorLabel={`Commenting at ${formatTimecode(currentMs)}`}
          />
        </div>
      </div>
    </div>
  );
}

const headerAction = {
  height: 'var(--sr-h-2xs)',
  padding: '0 12px',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 12.5,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  borderRadius: 'var(--sr-radius-control)',
} as const;
