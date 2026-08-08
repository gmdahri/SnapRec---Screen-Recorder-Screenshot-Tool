import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Logo } from '@snaprec/design-system';

const CHROME_STORE =
  'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg';

/** The marketing nav. 60px, paper on a panel-light page.
 *
 * Separate from the app's AppShell rail: this is the surface for people who
 * have no account, so it carries the two things they might do — sign in, or
 * install — and three anchors, and nothing else. */
export function LandingNav() {
  return (
    <div style={{
      height: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      padding: '0 40px',
      background: 'var(--sr-surface-paper)',
      borderBottom: '1px solid var(--sr-border-light-soft)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9,
          fontSize: 15, fontWeight: 600, letterSpacing: '-.01em',
          color: 'var(--sr-text-primary-on-light)', textDecoration: 'none',
        }}
      >
        <Logo size={17} />
        SnapRec
      </Link>

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 20,
        fontSize: 13.5, color: 'var(--sr-text-muted-on-light)',
      }}>
        <a href="#how" style={navLink}>How it works</a>
        <a href="#compare" style={navLink}>Compare</a>
        <a href="#faq" style={navLink}>FAQ</a>
      </span>

      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        <Link to="/login" style={{
          height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center',
          fontSize: 13.5, color: 'var(--sr-text-muted-on-light)', textDecoration: 'none',
        }}>Sign in</Link>

        <a
          href={CHROME_STORE}
          target="_blank"
          rel="noopener"
          style={{
            height: 34, padding: '0 15px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--sr-text-primary-on-light)', color: '#fff',
            fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            borderRadius: 'var(--sr-radius-control)',
          }}
        >
          <Icon icon="ant-design:chrome-outlined" width={14} aria-hidden="true" />
          Add to Chrome
        </a>
      </span>
    </div>
  );
}

const navLink = {
  color: 'var(--sr-text-muted-on-light)',
  textDecoration: 'none',
} as const;
