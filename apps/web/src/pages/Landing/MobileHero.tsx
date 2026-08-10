import { useState } from 'react';
import { Icon } from '@iconify/react';
import { CaptureFrame } from '@snaprec/design-system';

export interface MobileHeroProps {
  onEmailLink?: (email: string) => void;
}

/** M2 — the landing page at 390px.
 *
 * Recording controls are hidden, not disabled: a disabled record button on a
 * phone reads as a broken product rather than as an unsupported one. The copy
 * explains where recording actually happens instead. */
export function MobileHero({ onEmailLink }: MobileHeroProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{
        margin: 0, fontSize: 28, fontWeight: 700,
        letterSpacing: '-.035em', lineHeight: 1.1,
      }}>Capture it. Make it clear. Share it.</h1>

      <p style={{
        margin: 0, fontSize: 14, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        Recording happens in desktop Chrome. On phones you can watch, comment
        on and manage anything already captured.
      </p>

      {/* A still with a play affordance — no autoplay on cellular. */}
      <div data-testid="mobile-demo">
        <CaptureFrame treatment="focused" style={{
          background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button type="button" data-min-height="48" aria-label="Play the demo" style={{
            width: 56, height: 56, minHeight: 48, borderRadius: '50%', border: 'none',
            background: 'var(--sr-surface-paper)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon icon="ant-design:caret-right-outlined" width={20} aria-hidden="true" />
          </button>
        </CaptureFrame>
      </div>

      {/* The email path is the real mobile conversion, so it sits beside the
          Chrome button rather than below the fold. */}
      <div data-testid="mobile-cta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href="https://chrome.google.com/webstore" data-min-height="48" style={{
          minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--sr-text-primary-on-light)', color: '#fff',
          fontSize: 15, fontWeight: 600, textDecoration: 'none',
          borderRadius: 'var(--sr-radius-control)',
        }}>Add to Chrome — free</a>

        <button
          type="button"
          data-min-height="48"
          onClick={() => {
            if (!email.trim()) return;
            onEmailLink?.(email.trim());
            setSent(true);
          }}
          style={{
            minHeight: 48, width: '100%',
            border: '1px solid var(--sr-border-light)', background: 'transparent',
            fontSize: 15, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
          }}
        >Email me the link</button>

        <input
          type="email"
          aria-label="Your email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            minHeight: 48, padding: '0 12px',
            border: '1px solid var(--sr-border-light)', background: '#fff',
            fontSize: 15, borderRadius: 'var(--sr-radius-control)',
          }}
        />

        {sent && (
          <span role="status" style={{ fontSize: 12.5, color: 'var(--sr-green)' }}>
            Sent — open it on your desktop.
          </span>
        )}
      </div>

      <p style={{
        margin: 0, fontFamily: 'var(--sr-font-mono)', fontSize: 11,
        color: 'var(--sr-text-faint-on-light)',
      }}>Free · no watermark · no account needed to record</p>
    </div>
  );
}
