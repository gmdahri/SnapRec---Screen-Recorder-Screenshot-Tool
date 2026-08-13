import { useState } from 'react';
import { Link } from 'react-router-dom';

export interface SignInPanelProps {
  onGoogle: () => void;
  onMagicLink: (email: string) => void;
  /** Shown above the form when the user was doing something first. */
  heading?: string;
  subheading?: string;
}

/** A1 — sign in.
 *
 * The copy says what an account adds, not what it gates. And it promises
 * explicitly that existing recordings survive, because the fear that signing in
 * will lose the thing you just recorded is the actual reason people bounce.
 *
 * Email sign-in is switched off for now, so Google is the only working route.
 * The field stays visible rather than being removed, because a sign-in page that
 * silently loses a method looks broken to anyone who used it before — and
 * `onMagicLink` stays in the props contract so re-enabling is a small revert. */
// `onMagicLink` is deliberately not destructured: it stays in the props contract
// for callers and for the eventual revert, but nothing may call it while email
// sign-in is off.
export function SignInPanel({ onGoogle, heading, subheading }: SignInPanelProps) {
  const [email, setEmail] = useState('');

  /** The controls below are disabled, so this normally cannot fire — but a form
   * still submits on Enter and can be submitted programmatically, so the refusal
   * lives here too rather than resting on the disabled attributes alone. */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>
        {heading ?? 'Sign in to SnapRec'}
      </h1>

      <p style={{
        margin: 0, fontSize: 13.5, lineHeight: 1.6, maxWidth: '52ch',
        color: 'var(--sr-text-muted-on-light)',
      }}>
        {subheading ?? 'An account keeps your captures in one library, lets you rename links, and shows you who watched.'}
      </p>

      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sr-text-muted-on-light)' }}>
        Nothing you have already recorded is lost by signing in.
      </p>

      <button type="button" onClick={onGoogle} style={{
        height: 'var(--sr-h-md)', border: '1px solid var(--sr-border-light)',
        background: '#fff', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
        borderRadius: 'var(--sr-radius-control)',
      }}>Continue with Google</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
          color: 'var(--sr-text-faint-on-light)',
        }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
      </div>

      {/* noValidate so our own message owns the failure. The native bubble is
          not reliably announced by screen readers and cannot be styled, and it
          suppresses submit entirely — which would leave the field invalid with
          nothing said about it. */}
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
            letterSpacing: '.1em', color: 'var(--sr-text-faint-on-light)',
          }}>Email</span>
          <input
            type="email"
            aria-label="Email"
            disabled
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              height: 'var(--sr-h-md)', padding: '0 12px',
              border: '1px solid var(--sr-border-light)',
              background: 'var(--sr-surface-panel-light)', fontSize: 13.5,
              color: 'var(--sr-text-faint-on-light)',
              borderRadius: 'var(--sr-radius-control)',
            }}
          />
        </label>

        <span style={{ fontSize: 12, color: 'var(--sr-text-muted-on-light)' }}>
          Email sign-in is coming soon. Use Google for now.
        </span>

        <button type="submit" disabled style={{
          height: 'var(--sr-h-md)', border: 'none',
          background: 'var(--sr-border-light)',
          color: 'var(--sr-text-faint-on-light)',
          fontSize: 13.5, fontWeight: 600, cursor: 'not-allowed',
          borderRadius: 'var(--sr-radius-control)',
        }}>Send a sign-in link</button>
      </form>

      <p style={{
        margin: 0, fontSize: 11.5, lineHeight: 1.6,
        color: 'var(--sr-text-faint-on-light)',
      }}>
        By continuing you agree to the <Link to="/terms">Terms</Link> and{' '}
        <Link to="/privacy">Privacy</Link> policy.
      </p>
    </div>
  );
}
