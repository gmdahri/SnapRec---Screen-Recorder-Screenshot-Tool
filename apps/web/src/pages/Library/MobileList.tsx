import { Icon } from '@iconify/react';
import { CAPTURE_STATES, StateRule, StatusBadge, type CaptureStatus, type StatusWord } from '@snaprec/design-system';

export interface MobileItem {
  id: string;
  title: string;
  kind: 'recording' | 'screenshot' | 'fullpage';
  status: CaptureStatus;
  length: string;
  created: string;
  progress?: number;
  thumbnailUrl?: string;
}

export interface MobileListProps {
  items: MobileItem[];
  onOpen: (id: string) => void;
  onActions: (id: string) => void;
  onInlineAction: (id: string, action: string) => void;
}

/** A list, not a shrunken grid.
 *
 * At 390px a two-up grid gives 180px plates with unreadable metadata. A
 * 100×60 preview plus three text lines fits more captures on screen and keeps
 * state and title legible. */
export function MobileList({ items, onOpen, onActions, onInlineAction }: MobileListProps) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(item => {
        const def = CAPTURE_STATES[item.status];
        const failed = item.status.endsWith('Failed');
        // Processing rows carry the rule and no actions — there is nothing to
        // do until it finishes.
        const hasOverflow = def.secondary.length > 0 && item.status !== 'processing';

        return (
          <li key={item.id} style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--sr-surface-paper)',
            padding: '10px 12px',
          }}>
            <StateRule status={item.status} progress={item.progress} edge="left" />

            <button
              type="button"
              data-min-target="44"
              onClick={() => onOpen(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
                border: 'none', background: 'transparent', padding: 0,
                textAlign: 'left', cursor: 'pointer', minHeight: 44,
              }}
            >
              <span style={{
                width: 100, height: 60, flex: 'none', overflow: 'hidden',
                background: 'var(--sr-surface-carbon)',
              }}>
                {def.canPreview && item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </span>

              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 13.5, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{item.title}</span>
                <span style={{
                  fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                  color: 'var(--sr-text-faint-on-light)',
                }}>{item.kind} · {item.length} · {item.created}</span>
                <StatusBadge status={def.label as StatusWord} />
              </span>
            </button>

            {/* Failures stay actionable inline — mobile does not demote states
                into menus. */}
            {failed && (
              <button
                type="button"
                data-min-target="44"
                onClick={() => onInlineAction(item.id, def.primary)}
                style={{
                  flex: 'none', minHeight: 44, padding: '0 11px',
                  border: '1px solid var(--sr-coral-text)', background: 'transparent',
                  color: 'var(--sr-coral-hover)', fontSize: 12, cursor: 'pointer',
                  borderRadius: 'var(--sr-radius-control)',
                }}
              >{def.primary}</button>
            )}

            {hasOverflow && (
              <button
                type="button"
                data-action="overflow"
                data-min-target="44"
                aria-label={`Actions for ${item.title}`}
                onClick={() => onActions(item.id)}
                style={{
                  flex: 'none', width: 44, minHeight: 44, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  color: 'var(--sr-text-muted-on-light)',
                }}
              >
                <Icon icon="ant-design:ellipsis-outlined" width={18} aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
