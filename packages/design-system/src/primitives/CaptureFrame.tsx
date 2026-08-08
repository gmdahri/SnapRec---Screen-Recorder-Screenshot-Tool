import type { CSSProperties, ReactNode } from 'react';

/** Registration-mark corners. The three treatments are a contract:
 *
 *  focused  — cyan marks inset from the corners, no handles. The media is the
 *             subject but cannot be resized, so it must not look draggable.
 *  passive  — a boundary only. Used while processing: there is nothing to
 *             focus on yet.
 *  editable — solid handles. Permitted on exactly two surfaces in the product:
 *             the video editor's trim points and the image editor's crop
 *             overlay. Nowhere else, ever. */
export type FrameTreatmentKind = 'focused' | 'passive' | 'editable';

export interface CaptureFrameProps {
  treatment: FrameTreatmentKind;
  /** Distance of the marks from the frame edge. */
  inset?: number;
  /** Arm length of each mark. */
  size?: number;
  tone?: 'cyan' | 'coral' | 'neutral';
  children?: ReactNode;
  style?: CSSProperties;
}

const TONE = {
  cyan: 'var(--sr-cyan)',
  coral: 'var(--sr-coral-mark)',
  neutral: 'var(--sr-border-light)',
} as const;

const CORNERS = [
  { x: 'left', y: 'top' },
  { x: 'right', y: 'top' },
  { x: 'left', y: 'bottom' },
  { x: 'right', y: 'bottom' },
] as const;

const HANDLES = [
  ['0%', '0%'], ['50%', '0%'], ['100%', '0%'],
  ['0%', '50%'], ['100%', '50%'],
  ['0%', '100%'], ['50%', '100%'], ['100%', '100%'],
] as const;

export function CaptureFrame({
  treatment, inset = 6, size = 11, tone = 'cyan', children, style,
}: CaptureFrameProps) {
  const color = TONE[tone];

  return (
    <div style={{ position: 'relative', ...style }}>
      {children}

      {treatment === 'focused' && CORNERS.map(c => (
        <span
          key={`${c.x}-${c.y}`}
          data-testid="registration-mark"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            [c.x]: inset,
            [c.y]: inset,
            [c.x === 'left' ? 'borderLeft' : 'borderRight']: `1px solid ${color}`,
            [c.y === 'top' ? 'borderTop' : 'borderBottom']: `1px solid ${color}`,
            // Named explicitly so a test can read the tone off any corner,
            // including the two that carry no top border.
            borderTopColor: color,
          }}
        />
      ))}

      {treatment === 'editable' && HANDLES.map(([left, top]) => (
        <span
          key={`${left}-${top}`}
          data-testid="handle"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left,
            top,
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            background: 'var(--sr-cyan)',
          }}
        />
      ))}
    </div>
  );
}
