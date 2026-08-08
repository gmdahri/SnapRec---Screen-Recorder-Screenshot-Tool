import type { ReactNode } from 'react';

export interface ActivityRowProps {
  actor: string;
  event: ReactNode;
  meta: string;
  thumbnail?: ReactNode;
  needsReply?: boolean;
  action?: { label: string; onSelect: () => void };
}

/** 44×26 capture frame + actor/event + inline action.
 *
 * Activity is never a bare notification: the capture it refers to is always
 * visible, so the user does not have to open something to find out what the
 * message is about. */
export function ActivityRow({
  actor, event, meta, thumbnail, needsReply, action,
}: ActivityRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      borderLeft: `2px solid ${needsReply ? 'var(--sr-coral-text)' : 'transparent'}`,
      background: 'var(--sr-surface-paper)',
      padding: '11px 14px',
    }}>
      {needsReply && (
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          letterSpacing: '.1em', color: 'var(--sr-coral-hover)', whiteSpace: 'nowrap',
        }}>needs a reply</span>
      )}

      <span
        data-testid="activity-thumb"
        style={{
          width: 44, height: 26, flex: 'none',
          background: 'var(--sr-surface-carbon)',
          position: 'relative', overflow: 'hidden',
        }}
      >{thumbnail}</span>

      <span style={{ fontSize: 13.5, flex: 1, color: 'var(--sr-text-primary-on-light)' }}>
        <strong style={{ fontWeight: 600 }}>{actor}</strong> {event}
      </span>

      <span style={{
        fontFamily: 'var(--sr-font-mono)', fontSize: 10,
        color: 'var(--sr-text-faint-on-light)', whiteSpace: 'nowrap',
      }}>{meta}</span>

      {action && (
        <button
          type="button"
          onClick={action.onSelect}
          style={{
            height: 'var(--sr-h-2xs)', padding: '0 13px',
            border: '1px solid var(--sr-text-primary-on-light)', background: 'transparent',
            color: 'var(--sr-text-primary-on-light)', fontSize: 12.5, fontWeight: 500,
            borderRadius: 'var(--sr-radius-control)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >{action.label}</button>
      )}
    </div>
  );
}
