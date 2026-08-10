import { Icon } from '@iconify/react';
import { createRegistry, tooltipFor } from '../../lib/shortcuts';
import { VIDEO_BINDINGS } from './bindings';

const registry = createRegistry(VIDEO_BINDINGS);

export interface TransportBarProps {
  playing: boolean;
  zoomLabel: string;
  isApple: boolean;
  onPlay: () => void;
  onStep: (direction: -1 | 1) => void;
  onSplit: () => void;
  onAddZoom: () => void;
  onTimelineZoom: (direction: -1 | 1) => void;
}

/** Split and Add zoom are the only two editing verbs.
 *
 * Speed, lane visibility and per-region settings appear only when something is
 * selected — a bar that shows every possible operation makes the two that
 * matter invisible. */
export function TransportBar({
  playing, zoomLabel, isApple, onPlay, onStep, onSplit, onAddZoom, onTimelineZoom,
}: TransportBarProps) {
  const tip = (label: string) => tooltipFor(label, registry.find(label), isApple);

  return (
    <div style={{
      height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 16px',
      borderTop: '1px solid var(--sr-border-dark-soft)',
      borderBottom: '1px solid var(--sr-border-dark-soft)',
    }}>
      <button type="button" onClick={onPlay} aria-label="Play" title={tip('Play')} style={{
        ...iconButton,
        background: 'var(--sr-text-primary-on-dark)',
        color: 'var(--sr-surface-carbon)',
      }}>
        <Icon icon={playing ? 'ant-design:pause-outlined' : 'ant-design:caret-right-outlined'}
          width={15} aria-hidden="true" />
      </button>

      <button type="button" onClick={() => onStep(-1)} aria-label="Previous edit point"
        title={tip('Previous edit point')} style={iconButton}>
        <Icon icon="ant-design:step-backward-outlined" width={14} aria-hidden="true" />
      </button>

      <button type="button" onClick={() => onStep(1)} aria-label="Next edit point"
        title={tip('Next edit point')} style={iconButton}>
        <Icon icon="ant-design:step-forward-outlined" width={14} aria-hidden="true" />
      </button>

      <span style={rule} aria-hidden="true" />

      <button type="button" onClick={onSplit} title={tip('Split')} style={verb}>
        <Icon icon="ant-design:scissor-outlined" width={13} aria-hidden="true" />Split
      </button>

      <button type="button" onClick={onAddZoom} title={tip('Add zoom')} style={verb}>
        <Icon icon="ant-design:zoom-in-outlined" width={13} aria-hidden="true" />Add zoom
      </button>

      <span style={rule} aria-hidden="true" />

      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <button type="button" onClick={() => onTimelineZoom(-1)} aria-label="Zoom timeline out"
          title="Zoom timeline out" style={iconButton}>
          <Icon icon="ant-design:zoom-out-outlined" width={13} aria-hidden="true" />
        </button>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-text-faint-on-dark)',
        }}>{zoomLabel}</span>
        <button type="button" onClick={() => onTimelineZoom(1)} aria-label="Zoom timeline in"
          title="Zoom timeline in" style={iconButton}>
          <Icon icon="ant-design:zoom-in-outlined" width={13} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

const iconButton = {
  width: 30, height: 30, flex: 'none', border: 'none',
  background: 'transparent', color: 'var(--sr-text-secondary-on-dark)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
} as const;

const verb = {
  height: 30, padding: '0 11px',
  border: '1px solid var(--sr-border-dark)', background: 'transparent',
  color: 'var(--sr-text-primary-on-dark)', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const rule = {
  width: 1, height: 20, background: 'var(--sr-border-dark)', flex: 'none',
} as const;
