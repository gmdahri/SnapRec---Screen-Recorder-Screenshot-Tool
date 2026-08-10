import { Icon } from '@iconify/react';

/** P7 E2.6 — the `ZOOM − 1× +` control beside the transport.
 *
 * This zooms the *timeline*, not the picture. The editor already has a "zoom"
 * that means magnifying the video, so the control is labelled and announced as
 * timeline zoom; two things called zoom on one screen is how people end up
 * scaling the wrong one.
 *
 * Steps are a fixed ladder rather than a multiplier so repeated clicks land on
 * the same values every time, and the label always reads back what is applied. */

export const ZOOM_STEPS = [1, 1.5, 2, 3, 4, 6, 8] as const;

export interface TimelineZoomProps {
  zoom: number;
  onChange: (zoom: number) => void;
}

export function clampZoomStep(zoom: number): number {
  return ZOOM_STEPS.reduce(
    (best, step) => (Math.abs(step - zoom) < Math.abs(best - zoom) ? step : best),
    ZOOM_STEPS[0],
  );
}

export function stepZoom(zoom: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.indexOf(clampZoomStep(zoom) as typeof ZOOM_STEPS[number]);
  const next = Math.min(Math.max(index + direction, 0), ZOOM_STEPS.length - 1);
  return ZOOM_STEPS[next];
}

const button = {
  width: 24, height: 'var(--sr-h-xs)', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--sr-border-dark)', background: 'transparent',
  color: 'var(--sr-text-secondary-on-dark)', cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

export function TimelineZoom({ zoom, onChange }: TimelineZoomProps) {
  const current = clampZoomStep(zoom);
  const atMin = current === ZOOM_STEPS[0];
  const atMax = current === ZOOM_STEPS[ZOOM_STEPS.length - 1];

  return (
    <div data-testid="timeline-zoom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'var(--sr-font-mono)', fontSize: 9.5, letterSpacing: '.1em',
        color: 'var(--sr-text-faint-on-dark)',
      }}>ZOOM</span>

      <button
        type="button"
        aria-label="Zoom timeline out"
        disabled={atMin}
        title={atMin ? 'Already showing the whole clip' : 'Show more of the clip'}
        onClick={() => onChange(stepZoom(current, -1))}
        style={{ ...button, opacity: atMin ? 0.4 : 1, cursor: atMin ? 'not-allowed' : 'pointer' }}
      >
        <Icon icon="ant-design:minus-outlined" width={11} aria-hidden="true" />
      </button>

      <span
        data-testid="timeline-zoom-value"
        style={{
          minWidth: 30, textAlign: 'center',
          fontFamily: 'var(--sr-font-mono)', fontSize: 11,
          color: 'var(--sr-text-primary-on-dark)',
        }}
      >{current}×</span>

      <button
        type="button"
        aria-label="Zoom timeline in"
        disabled={atMax}
        title={atMax ? 'Already at the closest view' : 'Show less of the clip, in more detail'}
        onClick={() => onChange(stepZoom(current, 1))}
        style={{ ...button, opacity: atMax ? 0.4 : 1, cursor: atMax ? 'not-allowed' : 'pointer' }}
      >
        <Icon icon="ant-design:plus-outlined" width={11} aria-hidden="true" />
      </button>
    </div>
  );
}
