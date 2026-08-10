import type { CSSProperties } from 'react';
import { Sweep } from './Sweep';

/** The gap between pressing Post and the comment existing.
 *
 * The composer empties on submit and the real row cannot be drawn until the
 * server has given it an id, so without this the text vanishes for the length
 * of a round trip and the thread looks like it swallowed what was written.
 *
 * A skeleton in the row's own geometry rather than a spinner: the thread
 * settles into its shape instead of jumping into it, which is the reasoning the
 * library's loading state already follows. Static blocks for the same reason it
 * uses them — the sweep along the edge is the one thing that moves, and it is
 * the product's single indeterminate signal, so this reads exactly as the
 * processing page does.
 *
 * The word `posting` is present because the state must not rest on the blocks
 * alone; assistive tech gets it once, politely, from the live region. */
export interface PendingCommentProps {
  /** `row` matches the video thread; `note` matches the image margin card. */
  variant?: 'row' | 'note';
  label?: string;
}

const bone = (width: number | string, height: number): CSSProperties => ({
  display: 'block', width, height,
  background: 'var(--sr-surface-panel-light)',
});

const mono: CSSProperties = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 10,
  color: 'var(--sr-text-faint-on-light)',
};

const offscreen: CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
};

export function PendingComment({
  variant = 'row', label = 'Posting your comment',
}: PendingCommentProps) {
  const note = variant === 'note';
  const markSize = note ? 18 : 26;

  return (
    <div
      data-testid="pending-comment"
      style={{
        position: 'relative',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: note ? '10px 11px 12px' : '13px 14px 15px',
        background: 'var(--sr-surface-paper)',
        border: note ? '1px solid var(--sr-border-light-soft)' : undefined,
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}
    >
      <span role="status" aria-live="polite" style={offscreen}>{label}</span>

      <span aria-hidden="true" style={{ ...bone(markSize, markSize), flex: 'none' }} />

      <span aria-hidden="true" style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={bone('32%', 10)} />
          <span style={{ flex: 1 }} />
          <span style={mono}>posting…</span>
        </span>
        <span style={bone('100%', 8)} />
        <span style={bone('68%', 8)} />
      </span>

      <Sweep surface="light" />
    </div>
  );
}
