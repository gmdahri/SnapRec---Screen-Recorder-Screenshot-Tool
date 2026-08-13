import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useExtensionStatus } from '../hooks/useExtensionStatus';

export interface CapturePopoverProps {
  onClose: () => void;
  onTroubleshoot?: () => void;
}

const ENTRY_POINTS = [
  ['ant-design:video-camera-outlined', 'Record a tab, window or screen'],
  ['ant-design:camera-outlined', 'Take a screenshot'],
] as const;

/** The web app cannot record — capture happens in the extension so it can reach
 * any tab. Saying so plainly beats a button that silently does nothing. */
export function CapturePopover({ onClose, onTroubleshoot }: CapturePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { status, version } = useExtensionStatus();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    ref.current?.querySelector<HTMLElement>('button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Start a capture"
      style={{
        position: 'absolute', right: 22, top: 8, width: 330, zIndex: 40,
        background: 'var(--sr-surface-carbon)',
        color: 'var(--sr-text-primary-on-dark)',
        padding: '14px 16px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Capture starts in the extension</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--sr-text-faint-on-dark)', display: 'inline-flex',
          }}
        >
          <Icon icon="ant-design:close-outlined" width={12} aria-hidden="true" />
        </button>
      </div>

      <p style={{
        fontSize: 12.5, lineHeight: 1.55, margin: '10px 0 12px',
        color: 'var(--sr-text-secondary-on-dark)',
      }}>
        SnapRec records through the Chrome extension so it can reach any tab.
        The web app is for reviewing, editing and sharing what you capture.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ENTRY_POINTS.map(([icon, label]) => (
          <span key={label} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            height: 'var(--sr-h-row)', padding: '0 10px',
            background: 'var(--sr-surface-panel-dark)', fontSize: 12.5,
          }}>
            <Icon icon={icon} width={14} style={{ color: 'var(--sr-cyan)' }} aria-hidden="true" />
            <span style={{ flex: 1 }}>{label}</span>
          </span>
        ))}
      </div>

      <button type="button" style={{
        width: '100%', height: 38, marginTop: 12, border: 'none', cursor: 'pointer',
        background: 'var(--sr-cyan)', color: 'var(--sr-cyan-fg)',
        fontSize: 13, fontWeight: 600, borderRadius: 'var(--sr-radius-control)',
      }}>Open the extension</button>

      <div style={{
        marginTop: 10, fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
        color: 'var(--sr-text-faint-on-dark)',
      }}>
        {status === 'connected' ? `Extension ${version} connected · `
          : status === 'checking' ? 'Checking for the extension · '
          : 'Extension not detected · '}
        <button type="button" onClick={onTroubleshoot} style={{
          border: 'none', background: 'transparent', padding: 0, font: 'inherit',
          color: 'var(--sr-cyan)', cursor: 'pointer', textDecoration: 'underline',
        }}>not working?</button>
      </div>
    </div>
  );
}
