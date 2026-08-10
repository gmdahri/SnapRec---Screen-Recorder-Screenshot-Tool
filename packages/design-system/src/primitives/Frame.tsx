import type { CSSProperties, ReactNode } from 'react';
import type { Surface } from './Button';

export type FrameTreatment = 'editable' | 'focused' | 'passive';

export interface FrameProps {
  treatment: FrameTreatment;
  /** Live dimension read-out. Rendered for editable frames only. */
  readout?: string;
  surface?: Surface;
  children?: ReactNode;
  style?: CSSProperties;
}

const HANDLE = 9;
const MARK = 11;

/** Solid handles sit ON the boundary — they signal "this can be resized". */
function editableHandles(): CSSProperties[] {
  const off = -(HANDLE / 2);
  return [
    { left: off, top: off },
    { right: off, top: off },
    { left: off, bottom: off },
    { right: off, bottom: off },
    { left: '50%', top: off, marginLeft: off },
    { left: '50%', bottom: off, marginLeft: off },
  ];
}

/** Registration marks sit INSET — passive, never on the boundary. */
function focusedMarks(): CSSProperties[] {
  const c = 'var(--sr-cyan)';
  return [
    { left: 6, top: 6, borderLeft: `1px solid ${c}`, borderTop: `1px solid ${c}` },
    { right: 6, top: 6, borderRight: `1px solid ${c}`, borderTop: `1px solid ${c}` },
    { left: 6, bottom: 6, borderLeft: `1px solid ${c}`, borderBottom: `1px solid ${c}` },
    { right: 6, bottom: 6, borderRight: `1px solid ${c}`, borderBottom: `1px solid ${c}` },
  ];
}

export function Frame({ treatment, readout, surface = 'light', children, style }: FrameProps) {
  const outline =
    treatment === 'editable'
      ? '1px solid var(--sr-cyan)'
      : `1px solid ${surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)'}`;

  const parts =
    treatment === 'editable' ? editableHandles() : treatment === 'focused' ? focusedMarks() : [];

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--sr-surface-well)',
        outline,
        borderRadius: 'var(--sr-radius-none)',
        ...style,
      }}
    >
      {children}
      {parts.map((p, i) => (
        <span
          key={i}
          data-part="mark"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: treatment === 'editable' ? HANDLE : MARK,
            height: treatment === 'editable' ? HANDLE : MARK,
            background: treatment === 'editable' ? 'var(--sr-cyan)' : 'transparent',
            ...p,
          }}
        />
      ))}
      {treatment === 'editable' && readout && (
        <span
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            fontFamily: 'var(--sr-font-mono)',
            fontSize: 9.5,
            color: 'var(--sr-cyan-fg)',
            background: 'var(--sr-cyan)',
            padding: '2px 5px',
          }}
        >
          {readout}
        </span>
      )}
    </div>
  );
}
