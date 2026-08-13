import { type ReactNode, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { CaptureFrame, StatusBadge } from '@snaprec/design-system';
import { SupportButton } from '../../components/SupportButton';
import { leadersVisible, type PointAnchor, type ShareComment } from './anchors';
import { CommentComposer, type NewComment } from './CommentComposer';
import { PendingComment } from './PendingComment';

export interface ImageCapture {
  id: string;
  title: string;
  owner: string;
  width: number;
  height: number;
  allowDownload: boolean;
}

export interface ImageShareProps {
  capture: ImageCapture;
  comments: ShareComment[];
  /** Width of the notes margin. Leaders are drawn only above 300px. */
  marginPx: number;
  /** Returns `false` when the comment is refused — the sign-in gate does
   * that, and the composer then keeps the draft. */
  onPost: (comment: NewComment) => void | boolean;
  /** A comment is in flight; the margin holds a skeleton note for it. */
  postingComment?: boolean;
  media?: ReactNode;
  onDownload?: () => void;
}

const PIN_SIZE = 22;

/** C2 — space is the anchor.
 *
 * Each comment owns a point on the image and a hairline leader runs from the
 * pin to its note. Pin states: outline unselected, cyan fill selected, coral
 * outline awaiting a reply, and resolved pins drop to a faint outline with the
 * note collapsed. Numbers make them distinguishable without colour. */
export function ImageShare({
  capture, comments, marginPx, onPost, postingComment, media, onDownload,
}: ImageShareProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const points = comments.filter(
    (c): c is ShareComment & { anchor: PointAnchor } => c.anchor.kind === 'point',
  );
  const open = points.filter(c => !c.resolved);
  const resolved = points.filter(c => c.resolved);
  const withLeaders = leadersVisible(marginPx);

  /** Normalised, not pixel: the same screenshot renders at different widths
   * and a pin must land on the same feature at every size. */
  const placePin = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setPending({
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    });
  };

  const pinTone = (comment: ShareComment) => {
    if (comment.resolved) return 'var(--sr-text-faint-on-light)';
    if (comment.needsReply) return 'var(--sr-coral-text)';
    return selected === comment.id ? 'var(--sr-cyan)' : 'var(--sr-text-primary-on-light)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--sr-surface-panel-light)' }}>
      <header style={{
        height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 22px', background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{capture.title}</span>
          <span style={{
            display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{capture.owner} · {capture.width}×{capture.height}</span>
        </span>

        <SupportButton surface="light" />

        {capture.allowDownload && (
          <button type="button" onClick={onDownload} aria-label="Download" style={headerAction}>
            <Icon icon="ant-design:download-outlined" width={14} aria-hidden="true" />
            Download
          </button>
        )}
      </header>

      <div style={{ display: 'flex', gap: 20, padding: '22px 22px 40px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CaptureFrame
            treatment="focused"
            style={{ background: 'var(--sr-surface-carbon)', width: '100%' }}
          >
            <div
              ref={canvasRef}
              data-testid="image-canvas"
              onClick={placePin}
              style={{
                position: 'relative',
                aspectRatio: `${capture.width} / ${capture.height}`,
                cursor: 'crosshair',
              }}
            >
              {media}

              {points.map(comment => (
                <button
                  key={comment.id}
                  type="button"
                  aria-label={`Pin ${comment.index}`}
                  aria-pressed={selected === comment.id}
                  data-resolved={comment.resolved ? 'true' : undefined}
                  data-needs-reply={comment.needsReply ? 'true' : undefined}
                  data-pin-size={PIN_SIZE}
                  onClick={e => { e.stopPropagation(); setSelected(comment.id); }}
                  style={{
                    position: 'absolute',
                    left: `${comment.anchor.x * 100}%`,
                    top: `${comment.anchor.y * 100}%`,
                    // Pins never scale with the image: they stay legible when
                    // the screenshot is zoomed.
                    width: PIN_SIZE, height: PIN_SIZE,
                    marginLeft: -PIN_SIZE / 2, marginTop: -PIN_SIZE / 2,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${pinTone(comment)}`,
                    background: selected === comment.id ? 'var(--sr-cyan)' : 'var(--sr-surface-paper)',
                    color: selected === comment.id ? 'var(--sr-cyan-fg)' : pinTone(comment),
                    opacity: comment.resolved ? 0.4 : 1,
                    fontFamily: 'var(--sr-font-mono)', fontSize: 11,
                    cursor: 'pointer', padding: 0,
                  }}
                >{comment.index}</button>
              ))}

              {pending && (
                <span
                  data-testid="pending-pin"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${pending.x * 100}%`, top: `${pending.y * 100}%`,
                    width: PIN_SIZE, height: PIN_SIZE,
                    marginLeft: -PIN_SIZE / 2, marginTop: -PIN_SIZE / 2,
                    border: '1px dashed var(--sr-cyan)',
                  }}
                />
              )}
            </div>
          </CaptureFrame>
        </div>

        <aside style={{ width: marginPx, flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.map(comment => (
            <div
              key={comment.id}
              data-testid={`note-${comment.index}`}
              data-selected={selected === comment.id ? 'true' : 'false'}
              onClick={() => setSelected(comment.id)}
              style={{
                position: 'relative',
                background: selected === comment.id ? 'var(--sr-cyan-tint)' : 'var(--sr-surface-paper)',
                border: '1px solid var(--sr-border-light-soft)',
                borderLeft: comment.needsReply
                  ? '2px solid var(--sr-coral-text)'
                  : '1px solid var(--sr-border-light-soft)',
                padding: '9px 11px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              {/* Leaders are conditional: below 300px of margin there is
                  nothing to lead into, so selection replaces connection. */}
              {withLeaders && (
                <span
                  data-testid="leader"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', right: '100%', top: 16, width: 16, height: 1,
                    background: 'var(--sr-border-light)',
                  }}
                />
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 16, height: 16, flex: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${pinTone(comment)}`,
                  fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                }}>{comment.index}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{comment.author}</span>
              </span>

              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--sr-text-muted-on-light)' }}>
                {comment.body}
              </span>

              {comment.needsReply && <StatusBadge status="needs a reply" />}
            </div>
          ))}

          {/* Sits with the open notes, which is what it is about to become.
              It carries no number and no leader: the pin is assigned by the
              server along with the id, and drawing either would be a guess. */}
          {postingComment && <PendingComment variant="note" />}

          {resolved.length > 0 && (
            <button
              type="button"
              onClick={() => setShowResolved(v => !v)}
              style={{
                alignSelf: 'flex-start', border: 'none', background: 'transparent',
                padding: '4px 0', cursor: 'pointer',
                fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                color: 'var(--sr-text-faint-on-light)',
              }}
            >{resolved.length} resolved</button>
          )}

          {showResolved && resolved.map(comment => (
            <div key={comment.id} style={{
              opacity: 0.6, fontSize: 12.5, padding: '6px 11px',
              background: 'var(--sr-surface-paper)',
              border: '1px solid var(--sr-border-light-soft)',
            }}>
              <strong style={{ fontWeight: 600 }}>{comment.author}</strong> {comment.body}
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <CommentComposer
              onPost={comment => {
                const taken = onPost(comment) !== false;
                // A viewer sent to sign in comes back to their pin as well as
                // their words.
                if (taken) setPending(null);
                return taken;
              }}
              anchorX={pending?.x}
              anchorY={pending?.y}
              anchorLabel={pending ? 'Commenting on the marked point' : 'Click the image to place a pin'}
            />
          </div>
        </aside>
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
