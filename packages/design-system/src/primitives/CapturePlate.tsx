import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { CAPTURE_STATES, type CaptureStatus, type StatusWord } from '../status';
import { StateRule } from './StateRule';
import { StatusBadge } from './StatusBadge';
import { CaptureFrame } from './CaptureFrame';

export interface CaptureAction {
  key: string;
  label: string;
  icon: string;
  onSelect: () => void;
  /** When present the action renders disabled and this becomes its tooltip.
   * A disabled action must always say when it becomes available — otherwise
   * it is a dead end. */
  disabledReason?: string;
}

export interface CapturePlateProps {
  title: string;
  meta: string;
  status: CaptureStatus;
  /** 0–100, for determinate work only. */
  progress?: number;
  kind: 'recording' | 'screenshot' | 'fullpage';
  duration?: string;
  dimensions?: string;
  actions?: CaptureAction[];
  footnotes?: ReactNode;
  selected?: boolean;
  onOpen?: () => void;
  onSelectToggle?: () => void;
  media?: ReactNode;
}

const KIND_ICON = {
  recording: 'ant-design:video-camera-outlined',
  screenshot: 'ant-design:camera-outlined',
  fullpage: 'ant-design:vertical-align-bottom-outlined',
} as const;

/** Media box + caption + hover action rail + state rule.
 *
 * This replaces Card entirely. If a surface finds itself wanting a card, it is
 * working around the state model — every capture in the product is a plate, and
 * the plate reads CAPTURE_STATES rather than being told how to look. */
export function CapturePlate({
  title, meta, status, progress, kind, duration, dimensions,
  actions = [], footnotes, selected = false, onOpen, onSelectToggle, media,
}: CapturePlateProps) {
  const def = CAPTURE_STATES[status];
  const stamp = duration ?? dimensions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <CaptureFrame
        treatment={def.canPreview ? 'focused' : 'passive'}
        style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9' }}
      >
        {def.canPreview && media}

        {onSelectToggle && def.canSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectToggle}
            aria-label={`Select ${title}`}
            style={{
              position: 'absolute', left: 8, top: 8,
              width: 16, height: 16, accentColor: 'var(--sr-cyan)',
            }}
          />
        )}

        {stamp && (
          <span style={{
            position: 'absolute', left: 8, bottom: 8,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 6px', background: 'rgba(4,7,8,.8)',
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-primary-on-dark)',
          }}>
            <Icon icon={KIND_ICON[kind]} width={10} aria-hidden="true" />
            {stamp}
          </span>
        )}

        {actions.length > 0 && (
          <div
            data-testid="action-rail"
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 34,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}
          >
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
                  color: a.disabledReason
                    ? 'var(--sr-text-faint-on-dark)'
                    : 'var(--sr-text-secondary-on-dark)',
                  cursor: a.disabledReason ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                }}
              >
                <Icon icon={a.icon} width={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <StateRule status={status} progress={progress} />
      </CaptureFrame>

      <button
        type="button"
        onClick={onOpen}
        style={{
          padding: '9px 2px 0', border: 'none', background: 'transparent',
          textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5,
          cursor: onOpen ? 'pointer' : 'default',
        }}
      >
        <span style={{
          fontSize: 13.5, fontWeight: 500, lineHeight: 1.35,
          color: 'var(--sr-text-primary-on-light)',
        }}>{title}</span>

        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-text-faint-on-light)',
        }}>{meta}</span>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {/* Every CAPTURE_STATES label is a StatusWord — the status test
              enforces it — but the field is typed `string` so percentage
              suffixes stay expressible. Do not widen StatusBadge's prop to
              string to avoid this cast: that would let any surface invent a
              status. */}
          <StatusBadge status={def.label as StatusWord} />
          {footnotes}
        </span>
      </button>
    </div>
  );
}
