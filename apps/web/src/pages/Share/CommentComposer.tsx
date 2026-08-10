import { useState } from 'react';

export interface NewComment {
  content: string;
  timecodeMs?: number;
  anchorX?: number;
  anchorY?: number;
}

export interface CommentComposerProps {
  /** Returning `false` refuses the comment and keeps the draft — that is what
   * the sign-in gate does. Anything else is taken as accepted and the field
   * clears, because the row is on its way. */
  onPost: (comment: NewComment) => void | boolean;
  /** Shown so the viewer knows where their comment will land. */
  anchorLabel?: string;
  timecodeMs?: number;
  anchorX?: number;
  anchorY?: number;
  /** Below 768 every control clears 44px — the composer is on that surface
   * too, so it is not exempt from the rule. */
  touch?: boolean;
}

/** Shared by both anchoring models.
 *
 * The anchor is attached here rather than at the call site so a comment can
 * never be posted without one when the surface has one to give — an unanchored
 * comment on a 6-minute video is almost useless.
 *
 * Nobody is asked for their name. Commenting requires an account, so the name
 * is already known; the box that used to sit here collected a string that was
 * dropped at every call site and never reached the server. */
export function CommentComposer({
  onPost, anchorLabel, timecodeMs, anchorX, anchorY, touch = false,
}: CommentComposerProps) {
  const controlHeight = touch ? 44 : 'var(--sr-h-2xs)';
  const [content, setContent] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    // Cleared only once the comment has been taken. A viewer who is sent to
    // sign in comes back to the words they wrote rather than an empty box.
    if (onPost({ content: trimmed, timecodeMs, anchorX, anchorY }) !== false) {
      setContent('');
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {anchorLabel && (
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-cyan-on-light)',
        }}>{anchorLabel}</span>
      )}

      <textarea
        aria-label="Write a comment"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={2}
        style={{
          border: '1px solid var(--sr-border-light)',
          background: 'var(--sr-surface-paper)',
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: 13,
          resize: 'vertical',
          borderRadius: 'var(--sr-radius-control)',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="submit"
          disabled={!content.trim()}
          data-min-target={touch ? 44 : undefined}
          style={{
            marginLeft: 'auto',
            minHeight: controlHeight, padding: '0 14px', flex: 'none',
            border: 'none', background: 'var(--sr-text-primary-on-light)', color: 'var(--sr-surface-paper)',
            fontSize: 12.5, fontWeight: 600,
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            opacity: content.trim() ? 1 : 0.5,
            borderRadius: 'var(--sr-radius-control)',
          }}
        >Post comment</button>
      </div>
    </form>
  );
}
