import type { CSSProperties, ReactNode } from 'react';

export interface LaneProps {
  name: 'clip' | 'zoom' | 'cuts' | 'audio';
  height: number;
  children: ReactNode;
  style?: CSSProperties;
}

/** One lane: a fixed label rail plus a track.
 *
 * Three lanes, not twelve tracks. The label rail is 74px on every lane so the
 * tracks share a left edge — a ragged edge makes it impossible to read a
 * moment vertically across the three. */
export function Lane({ name, height, children, style }: LaneProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <span style={{
        width: 74, flex: 'none', display: 'flex', alignItems: 'center',
        fontFamily: 'var(--sr-font-mono)', fontSize: 9,
        letterSpacing: '.08em', color: 'var(--sr-text-faint-on-dark)',
      }}>{name}</span>

      <div
        role="group"
        aria-label={name}
        style={{
          flex: 1, position: 'relative', height,
          background: 'var(--sr-surface-panel-dark)',
          ...style,
        }}
      >{children}</div>
    </div>
  );
}
