import type { StatusWord } from '../status';
import type { Surface } from './Button';

/** Only these two statuses may wear coral. */
const CORAL: ReadonlySet<StatusWord> = new Set<StatusWord>(['recording', 'needs a reply']);

/** The sharing family reads cyan. */
const CYAN: ReadonlySet<StatusWord> = new Set<StatusWord>([
  'shared', 'link ready', 'uploading', 'processing', 'exporting',
]);

export interface StatusBadgeProps {
  status: StatusWord;
  surface?: Surface;
}

/** 19px outlined badge: word plus shape, never a filled pill.
 *
 * Replaces P0's 22px StatusChip — 22 was a guess, and the standalone
 * prototypes are specific. */
export function StatusBadge({ status, surface = 'light' }: StatusBadgeProps) {
  const coral = CORAL.has(status);
  const cyan = CYAN.has(status);
  const failed = status.endsWith('failed');

  const color = coral || failed
    ? 'var(--sr-coral-hover)'
    : cyan
      ? surface === 'dark' ? 'var(--sr-cyan)' : 'var(--sr-cyan-on-light)'
      : surface === 'dark' ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-faint-on-light)';

  return (
    <span
      data-testid="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 19,
        padding: '0 7px',
        background: 'transparent',
        border: `1px solid ${
          cyan
            ? 'var(--sr-cyan)'
            : surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)'
        }`,
        fontFamily: 'var(--sr-font-mono)',
        fontSize: 9.5,
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {(cyan || coral) && (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            background: coral ? 'var(--sr-coral-mark)' : 'var(--sr-cyan)',
            borderRadius: status === 'recording' ? '50%' : 0,
          }}
        />
      )}
      {status}
    </span>
  );
}
