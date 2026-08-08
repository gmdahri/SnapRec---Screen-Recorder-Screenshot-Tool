import { CaptureFrame, StatusBadge } from '@snaprec/design-system';
import { SignInPanel, type SignInPanelProps } from './SignInPanel';

export interface PendingCapture {
  title: string;
  meta: string;
  kind: 'recording' | 'screenshot';
  expiresInDays: number;
}

export interface ReturnToTaskProps extends Pick<SignInPanelProps, 'onGoogle' | 'onMagicLink'> {
  pending: PendingCapture;
  onShareWithoutAccount: () => void;
}

/** A2 — signing in mid-task.
 *
 * The pending capture stays visible throughout. People abandon when they
 * cannot see what they are protecting, and the recording is in local storage
 * until upload confirms — so a failed sign-in never destroys it and the copy
 * should not imply otherwise. */
export function ReturnToTask({
  pending, onGoogle, onMagicLink, onShareWithoutAccount,
}: ReturnToTaskProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--sr-surface-panel-light)', padding: 12,
      }}>
        <CaptureFrame treatment="focused" style={{
          width: 84, height: 48, flex: 'none', background: 'var(--sr-surface-carbon)',
        }} />

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{pending.title}</span>
          <span style={{
            display: 'block', marginTop: 3, fontFamily: 'var(--sr-font-mono)',
            fontSize: 10, color: 'var(--sr-text-faint-on-light)',
          }}>{pending.meta}</span>
        </span>

        <StatusBadge status="on this device" />
      </div>

      <SignInPanel
        onGoogle={onGoogle}
        onMagicLink={onMagicLink}
        heading="Sign in and we'll take you back here"
        subheading="Your capture is waiting on this device. Signing in moves it into your library and gives it a permanent link."
      />

      {/* Sharing without an account stays available, and honest about expiry. */}
      <div style={{
        borderTop: '1px solid var(--sr-border-light-soft)', paddingTop: 14,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <button type="button" onClick={onShareWithoutAccount} style={{
          alignSelf: 'flex-start', height: 'var(--sr-h-2xs)', padding: '0 14px',
          border: '1px solid var(--sr-border-light)', background: 'transparent',
          fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
        }}>Share without an account</button>

        <span style={{ fontSize: 11.5, color: 'var(--sr-text-faint-on-light)' }}>
          That link expires in {pending.expiresInDays} days.
        </span>
      </div>
    </div>
  );
}
