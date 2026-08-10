import { Link, NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Logo } from '@snaprec/design-system';

const CHROME_STORE =
  'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg';

export interface NavLinkSpec {
  label: string;
  /** A route, or an in-page anchor. */
  to: string;
}

/** The landing page's own three anchors. Only valid on `/` — they point at
 * sections that exist nowhere else. */
export const LANDING_LINKS: NavLinkSpec[] = [
  { label: 'How it works', to: '#how' },
  { label: 'Compare', to: '#compare' },
  { label: 'FAQ', to: '#faq' },
];

/** Everywhere else. The prototype shows the landing set, but dropping these
 * from the rest of the site would orphan pages that carry real search
 * traffic — so other pages keep their destinations and gain the styling. */
export const SITE_LINKS: NavLinkSpec[] = [
  { label: 'How it works', to: '/how-it-works' },
  { label: 'Blog', to: '/blog' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

export interface LandingNavbarProps {
  links?: NavLinkSpec[];
}

/** 60px, paper on a panel-light page. The marketing counterpart to AppShell's
 * carbon rail: for people with no account, so it carries the two things they
 * might do — sign in, or install — and nothing else. */
export function LandingNavbar({ links = SITE_LINKS }: LandingNavbarProps) {
  return (
    <nav
      aria-label="Main"
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '0 clamp(16px, 4vw, 40px)',
        background: 'var(--sr-surface-paper)',
        borderBottom: '1px solid var(--sr-border-light-soft)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        fontSize: 15, fontWeight: 600, letterSpacing: '-.01em',
        color: 'var(--sr-text-primary-on-light)', textDecoration: 'none',
        flex: 'none',
      }}>
        <Logo size={17} />
        SnapRec
      </Link>

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 20,
        fontSize: 13.5, overflow: 'hidden',
      }}>
        {links.map(link => (
          link.to.startsWith('#')
            ? <a key={link.to} href={link.to} style={linkStyle}>{link.label}</a>
            : (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  ...linkStyle,
                  color: isActive
                    ? 'var(--sr-text-primary-on-light)'
                    : 'var(--sr-text-muted-on-light)',
                })}
              >{link.label}</NavLink>
            )
        ))}
      </span>

      <span style={{
        marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, flex: 'none',
      }}>
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
            fontSize: 13.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
            borderRadius: 'var(--sr-radius-control)',
          }}
        >
          <Icon icon="ant-design:chrome-outlined" width={14} aria-hidden="true" />
          Add to Chrome
        </a>
      </span>
    </nav>
  );
}

const linkStyle = {
  color: 'var(--sr-text-muted-on-light)',
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};
