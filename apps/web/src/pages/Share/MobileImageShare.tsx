import { type ReactNode, useState } from 'react';
import { StatusBadge } from '@snaprec/design-system';
import type { PointAnchor, ShareComment } from './anchors';
import { CommentComposer, type NewComment } from './CommentComposer';
import { PendingComment } from './PendingComment';
import type { ImageCapture } from './ImageShare';

export interface MobileImageShareProps {
  capture: ImageCapture;
  comments: ShareComment[];
  /** Returns `false` when the comment is refused — the sign-in gate does
   * that, and the composer then keeps the draft. */
  onPost: (comment: NewComment) => void | boolean;
  /** A comment is in flight; the list holds a skeleton row for it. */
  postingComment?: boolean;
  media?: ReactNode;
}

const PIN_SIZE = 22;

/** C4 — no leaders here.
 *
 * There is no margin to lead into, so selection replaces connection: the
 * comment row fills cyan and its pin gains a halo. The pairing stays
 * unambiguous because both carry the same number.
 *
 * Pins stay 22px — they never scale with the image, so they remain legible
 * when the screenshot is zoomed — but their tap area is padded to 44px. */
export function MobileImageShare({
  capture, comments, onPost, postingComment, media,
}: MobileImageShareProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const points = comments.filter(
    (c): c is ShareComment & { anchor: PointAnchor } => c.anchor.kind === 'point',
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sr-surface-panel-light)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 12px',
        background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{capture.title}</span>
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{capture.owner} · {capture.width}×{capture.height}</span>
        </span>
      </header>

      <div style={{
        position: 'relative', background: 'var(--sr-surface-carbon)',
        aspectRatio: `${capture.width} / ${capture.height}`,
      }}>
        {media}

        {points.map(comment => (
          <button
            key={comment.id}
            type="button"
            aria-label={`Pin ${comment.index}`}
            aria-pressed={selected === comment.id}
            data-pin-size={PIN_SIZE}
            data-min-target="44"
            data-halo={selected === comment.id ? 'true' : undefined}
            onClick={() => setSelected(comment.id)}
            style={{
              position: 'absolute',
              left: `${comment.anchor.x * 100}%`,
              top: `${comment.anchor.y * 100}%`,
              // 44px hit area, 22px mark: the target is padded, not enlarged.
              width: 44, height: 44, marginLeft: -22, marginTop: -22,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
              boxShadow: selected === comment.id
                ? '0 0 0 3px rgba(6, 166, 192, .35)'
                : undefined,
              borderRadius: selected === comment.id ? '50%' : undefined,
            }}
          >
            <span style={{
              width: PIN_SIZE, height: PIN_SIZE,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${comment.needsReply ? 'var(--sr-coral-text)' : 'var(--sr-text-primary-on-light)'}`,
              background: selected === comment.id ? 'var(--sr-cyan)' : 'var(--sr-surface-paper)',
              color: selected === comment.id ? 'var(--sr-cyan-fg)' : 'var(--sr-text-primary-on-light)',
              fontFamily: 'var(--sr-font-mono)', fontSize: 11,
            }}>{comment.index}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {points.map(comment => (
          <div
            key={comment.id}
            data-testid={`note-${comment.index}`}
            data-selected={selected === comment.id ? 'true' : 'false'}
            onClick={() => setSelected(comment.id)}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              minHeight: 44, padding: '10px 12px', cursor: 'pointer',
              background: selected === comment.id
                ? 'var(--sr-cyan-tint)'
                : 'var(--sr-surface-paper)',
              borderLeft: comment.needsReply ? '2px solid var(--sr-coral-text)' : '2px solid transparent',
            }}
          >
            <span style={{
              width: 18, height: 18, flex: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--sr-text-primary-on-light)',
              fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            }}>{comment.index}</span>

            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{comment.author}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--sr-text-muted-on-light)' }}>
                {comment.body}
              </span>
              {comment.needsReply && <StatusBadge status="needs a reply" />}
            </span>
          </div>
        ))}

        {/* No number and no pin — the server assigns both with the id. */}
        {postingComment && <PendingComment variant="note" />}

        <div style={{ marginTop: 12 }}>
          <CommentComposer touch onPost={onPost} anchorLabel="Tap the image to place a pin" />
        </div>
      </div>
    </div>
  );
}
