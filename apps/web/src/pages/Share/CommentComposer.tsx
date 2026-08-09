import { useState } from 'react';

export interface NewComment {
  content: string;
  authorName?: string;
  timecodeMs?: number;
  anchorX?: number;
  anchorY?: number;
}

export interface CommentComposerProps {
  onPost: (comment: NewComment) => void;
  /** Shown so the viewer knows where their comment will land. */
  anchorLabel?: string;
  timecodeMs?: number;
  anchorX?: number;
  anchorY?: number;
  /** Anonymous viewers are asked for a name; signed-in ones are not. */
  askForName?: boolean;
  /** Below 768 every control clears 44px — the composer is on that surface
   * too, so it is not exempt from the rule. */
  touch?: boolean;
}

/** Shared by both anchoring models.
 *
 * The anchor is attached here rather than at the call site so a comment can
 * never be posted without one when the surface has one to give — an unanchored
 * comment on a 6-minute video is almost useless. */
export function CommentComposer({
  onPost, anchorLabel, timecodeMs, anchorX, anchorY, askForName = true, touch = false,
}: CommentComposerProps) {
  const controlHeight = touch ? 44 : 'var(--sr-h-2xs)';
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    onPost({
      content: trimmed,
      authorName: authorName.trim() || undefined,
      timecodeMs,
      anchorX,
      anchorY,
    });

    setContent('');
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
        {askForName && (
          <input
            type="text"
            aria-label="Your name"
            placeholder="Your name"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            style={{
              flex: 1, minWidth: 0, minHeight: controlHeight, padding: '0 10px',
              border: '1px solid var(--sr-border-light)', background: 'var(--sr-surface-paper)',
              fontSize: 12.5, borderRadius: 'var(--sr-radius-control)',
            }}
          />
        )}

        <button
          type="submit"
          disabled={!content.trim()}
          data-min-target={touch ? 44 : undefined}
          style={{
            marginLeft: askForName ? undefined : 'auto',
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
