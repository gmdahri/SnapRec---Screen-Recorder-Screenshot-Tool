import { CaptureFrame } from '@snaprec/design-system';
import type { ZoomKeyframe } from './types';

/** P7 E1.4 — what the stage draws over the frame while a zoom is selected.
 *
 * The rectangle uses the design system's `editable` frame, so its handles are
 * the same marks every other resizable thing in the product uses. The stage
 * itself uses `focused` — corner marks, no handles — because the stage is not
 * resizable, only what sits inside it is.
 *
 * The label states the window in the same clock the transport and timeline use.
 * A zoom is a range, not a moment, so it reads `01:08 → 01:19`; showing only a
 * start would leave people guessing where it lets go. */

export interface StageZoomOverlayProps {
  keyframe: ZoomKeyframe | null;
}

const clock = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export function StageZoomOverlay({ keyframe }: StageZoomOverlayProps) {
  if (!keyframe) return null;

  const end = keyframe.timestamp + Math.max(0, keyframe.duration);

  // The pivot is a percentage of the frame; the window is drawn around it and
  // clamped so a pivot near an edge does not push the rectangle off the stage.
  const width = 100 / keyframe.scale;
  const height = 100 / keyframe.scale;
  const left = Math.min(Math.max(keyframe.x - width / 2, 0), 100 - width);
  const top = Math.min(Math.max(keyframe.y - height / 2, 0), 100 - height);

  return (
    <div
      data-testid="stage-zoom-overlay"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <span
        data-testid="zoom-label"
        style={{
          position: 'absolute', left: `${left}%`, top: `calc(${top}% - 20px)`,
          fontFamily: 'var(--sr-font-mono)', fontSize: 10, letterSpacing: '.06em',
          color: 'var(--sr-cyan)', whiteSpace: 'nowrap',
        }}
      >
        {`ZOOM ${keyframe.scale.toFixed(1)}× · ${clock(keyframe.timestamp)} → ${clock(end)}`}
      </span>

      <CaptureFrame
        treatment="editable"
        style={{
          position: 'absolute',
          left: `${left}%`, top: `${top}%`,
          width: `${width}%`, height: `${height}%`,
          background: 'transparent',
          // The editable frame draws handles but no edge. Without an outline
          // the eight handles read as loose dots rather than one window.
          outline: '1px solid var(--sr-cyan)',
          outlineOffset: -1,
        }}
      />
    </div>
  );
}
