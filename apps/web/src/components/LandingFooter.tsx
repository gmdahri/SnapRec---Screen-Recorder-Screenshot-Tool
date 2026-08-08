import { Link, NavLink } from 'react-router-dom';
import { Logo } from '@snaprec/design-system';

const GITHUB = 'https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool';
const CHROME_STORE =
  'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg';

interface Column {
  title: string;
  links: { label: string; to: string; external?: boolean }[];
}

const COLUMNS: Column[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Chrome extension', to: CHROME_STORE, external: true },
      { label: 'Changelog', to: '/changelog' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { label: 'SnapRec vs Loom', to: '/loom-alternative' },
      { label: 'SnapRec vs Screencastify', to: '/screencastify-alternative' },
      { label: 'For teachers', to: '/screen-recorder-for-teachers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
];

/** The marketing footer, on the plate.
 *
 * Column headings are mono and tracked like every other section label in the
 * product, rather than bold sentence case — the footer is the last thing on
 * twelve pages, and a different type system there undoes the rest. */
export function LandingFooter() {
  return (
    <footer style={{
      background: 'var(--sr-surface-paper)',
      borderTop: '1px solid var(--sr-border-light-soft)',
      padding: '56px clamp(16px, 4vw, 40px) 32px',
    }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 40,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            fontSize: 15, fontWeight: 600, letterSpacing: '-.01em',
            color: 'var(--sr-text-primary-on-light)', textDecoration: 'none',
          }}>
            <Logo size={17} />
            SnapRec
          </Link>

          <p style={{
            margin: 0, fontSize: 12.5, lineHeight: 1.6, maxWidth: '34ch',
            color: 'var(--sr-text-muted-on-light)',
          }}>
            Record a tab, mark up what matters, send a link. Free, no watermark,
            and it works before you make an account.
          </p>
        </div>

        {COLUMNS.map(column => (
          <div key={column.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--sr-font-mono)', fontSize: 10, fontWeight: 400,
              letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
            }}>{column.title}</h2>

            <ul style={{
              listStyle: 'none', margin: 0, padding: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {column.links.map(link => (
                <li key={link.label}>
                  {link.external
                    ? <a href={link.to} target="_blank" rel="noopener" style={linkStyle}>{link.label}</a>
                    : <NavLink to={link.to} style={linkStyle}>{link.label}</NavLink>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        maxWidth: 1320, margin: '40px auto 0',
        paddingTop: 20,
        borderTop: '1px solid var(--sr-border-light-soft)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
        fontFamily: 'var(--sr-font-mono)', fontSize: 10,
        color: 'var(--sr-text-faint-on-light)',
      }}>
        <span>© {new Date().getFullYear()} SnapRec</span>
        <a href={GITHUB} target="_blank" rel="noopener" style={{ ...linkStyle, fontSize: 10 }}>
          GitHub
        </a>
        <span style={{ marginLeft: 'auto' }}>Built for Chrome, Edge and Brave</span>
      </div>
    </footer>
  );
}

const linkStyle = {
  fontSize: 13,
  color: 'var(--sr-text-muted-on-light)',
  textDecoration: 'none',
} as const;
