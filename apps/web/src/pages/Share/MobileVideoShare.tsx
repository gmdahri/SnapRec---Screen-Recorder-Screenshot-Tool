import { type ReactNode, useState } from 'react';
import { Icon } from '@iconify/react';
import { StatusBadge } from '@snaprec/design-system';
import { BottomSheet } from '../../components/BottomSheet';
import { formatTimecode, type ShareComment } from './anchors';
import { CommentComposer, type NewComment } from './CommentComposer';
import type { ShareCapture } from './VideoShare';

export interface MobileVideoShareProps {
  capture: ShareCapture;
  comments: ShareComment[];
  currentMs?: number;
  onSeek: (ms: number) => void;
  onPost: (comment: NewComment) => void;
  player?: ReactNode;
  onDownload?: () => void;
}

/** C3 — the media stays pinned.
 *
 * The player sticks below the header while the comment sheet scrolls under it,
 * so seeking from a comment never scrolls the video out of view. The timecode
 * column survives from desktop; the column-on-the-time-axis layout does not —
 * it becomes a list. */
export function MobileVideoShare({
  capture, comments, currentMs = 0, onSeek, onPost, player, onDownload,
}: MobileVideoShareProps) {
  const [overflow, setOverflow] = useState(false);
  const awaiting = comments.filter(c => c.needsReply).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sr-surface-panel-light)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        minHeight: 52, background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 13.5, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{capture.title}</span>
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{capture.owner}</span>
        </span>

        {/* Destructive and file actions move behind More, so they are never
            adjacent to playback. */}
        <button
          type="button"
          data-min-target="44"
          aria-label="More"
          onClick={() => setOverflow(true)}
          style={iconButton}
        >
          <Icon icon="ant-design:ellipsis-outlined" width={18} aria-hidden="true" />
        </button>
      </header>

      <div
        data-testid="sticky-player"
        data-sticky="true"
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9',
        }}
      >{player}</div>

      <div style={{ padding: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 10px',
        }}>
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            letterSpacing: '.1em', color: 'var(--sr-text-faint-on-light)',
          }}>{comments.length} comments</span>
          {awaiting > 0 && (
            <span style={{
              fontFamily: 'var(--sr-font-mono)', fontSize: 10,
              color: 'var(--sr-coral-hover)',
            }}>· {awaiting} needs a reply</span>
          )}
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {comments.map(comment => (
            <li key={comment.id}>
              <button
                type="button"
                data-min-target="44"
                onClick={() => comment.anchor.kind === 'timecode' && onSeek(comment.anchor.ms)}
                style={{
                  width: '100%', minHeight: 44, textAlign: 'left',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  background: 'var(--sr-surface-paper)',
                  border: 'none',
                  borderLeft: comment.needsReply ? '2px solid var(--sr-coral-text)' : '2px solid transparent',
                  padding: '10px 12px', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: 'var(--sr-font-mono)', fontSize: 11, flex: 'none',
                  color: 'var(--sr-cyan-on-light)', paddingTop: 1,
                }}>
                  {comment.anchor.kind === 'timecode' ? formatTimecode(comment.anchor.ms) : ''}
                </span>

                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{comment.author}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--sr-text-muted-on-light)' }}>
                    {comment.body}
                  </span>
                  {comment.needsReply && <StatusBadge status="needs a reply" />}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 14 }}>
          <CommentComposer
            touch
            onPost={onPost}
            timecodeMs={currentMs}
            anchorLabel={`Commenting at ${formatTimecode(currentMs)}`}
          />
        </div>
      </div>

      {overflow && (
        <BottomSheet label="Capture actions" onClose={() => setOverflow(false)}>
          {capture.allowDownload && (
            <button
              type="button"
              data-min-target="44"
              onClick={() => { onDownload?.(); setOverflow(false); }}
              style={sheetRow}
            >Download</button>
          )}
          <button type="button" data-min-target="44" onClick={() => setOverflow(false)} style={sheetRow}>
            Copy link
          </button>
        </BottomSheet>
      )}
    </div>
  );
}

const iconButton = {
  width: 44, minHeight: 44, flex: 'none', border: 'none',
  background: 'transparent', cursor: 'pointer',
  color: 'var(--sr-text-muted-on-light)',
} as const;

const sheetRow = {
  display: 'flex', alignItems: 'center', width: '100%', minHeight: 44,
  padding: '0 18px', border: 'none', background: 'transparent',
  textAlign: 'left', fontSize: 14, cursor: 'pointer',
  color: 'var(--sr-text-primary-on-light)',
} as const;
