import { Icon } from '@iconify/react';
import { CAPTURE_STATES, KIND_LABEL, type CaptureStatus, type StatusWord } from '../status';
import { StateRule } from './StateRule';
import { StatusBadge } from './StatusBadge';
import type { CaptureAction } from './CapturePlate';

/** The responsive ladder, from the prototype's RESP scene:
 *  9 → desktop, 7 → 1024–1279 (size and collection drop),
 *  5 → 768–1023 (title, type, length, created, status).
 *
 * Below 768 the list is the only view and uses a different component — a row
 * this wide does not survive 390px. */
export type RowColumns = 9 | 7 | 5;

export interface CaptureRowProps {
  title: string;
  kind: 'recording' | 'screenshot' | 'fullpage';
  length: string;
  created: string;
  size?: string;
  collection?: string;
  sharing?: 'shared' | 'private';
  activity?: string;
  status: CaptureStatus;
  progress?: number;
  columns?: RowColumns;
  actions?: CaptureAction[];
  selected?: boolean;
  onOpen?: () => void;
  onSelectToggle?: () => void;
}

const mono = {
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 10.5,
  color: 'var(--sr-text-faint-on-light)',
} as const;

export function CaptureRow({
  title, kind, length, created, size, collection, sharing, activity,
  status, progress, columns = 9, actions = [], selected = false,
  onOpen, onSelectToggle,
}: CaptureRowProps) {
  const def = CAPTURE_STATES[status];
  const show9 = columns === 9;
  const show7 = columns >= 7;

  return (
    <div
      role="row"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: [
          onSelectToggle && def.canSelect ? '28px' : null,
          'minmax(0, 3fr)', '90px', '70px', '90px',
          show9 ? '80px' : null,
          show9 ? '110px' : null,
          show7 ? '90px' : null,
          show7 ? '140px' : null,
          '110px',
          actions.length ? '80px' : null,
        ].filter(Boolean).join(' '),
        alignItems: 'center',
        gap: 12,
        height: 'var(--sr-h-row)',
        paddingLeft: 12,
        borderBottom: '1px solid var(--sr-border-light-soft)',
        background: selected ? 'var(--sr-cyan-tint)' : 'transparent',
      }}
    >
      <StateRule status={status} progress={progress} edge="left" />

      {onSelectToggle && def.canSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelectToggle}
          aria-label={`Select ${title}`}
          style={{ accentColor: 'var(--sr-cyan)' }}
        />
      )}

      <span role="cell" style={{ minWidth: 0 }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: 'none', background: 'transparent', padding: 0, textAlign: 'left',
            fontSize: 13, fontWeight: 500, color: 'var(--sr-text-primary-on-light)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            width: '100%', cursor: onOpen ? 'pointer' : 'default',
          }}
        >{title}</button>
      </span>

      <span role="cell" style={mono}>{KIND_LABEL[kind]}</span>
      <span role="cell" style={mono}>{length}</span>
      <span role="cell" style={mono}>{created}</span>
      {show9 && <span role="cell" style={mono}>{size}</span>}
      {show9 && <span role="cell" style={mono}>{collection}</span>}
      {show7 && <span role="cell" style={mono}>{sharing}</span>}
      {show7 && <span role="cell" style={mono}>{activity}</span>}

      <span role="cell"><StatusBadge status={def.label as StatusWord} /></span>

      {actions.length > 0 && (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {actions.map(a => (
            <button
              key={a.key}
              type="button"
              onClick={a.disabledReason ? undefined : a.onSelect}
              aria-disabled={a.disabledReason ? 'true' : undefined}
              title={a.disabledReason ?? a.label}
              aria-label={a.label}
              style={{
                border: 'none', background: 'transparent', padding: 0,
                color: 'var(--sr-text-muted-on-light)', display: 'inline-flex',
                cursor: a.disabledReason ? 'not-allowed' : 'pointer',
              }}
            >
              <Icon icon={a.icon} width={14} aria-hidden="true" />
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
