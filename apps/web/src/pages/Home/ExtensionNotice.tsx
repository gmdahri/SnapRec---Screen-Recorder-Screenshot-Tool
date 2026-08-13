import { useState } from 'react';
import type { ExtensionStatus } from '../../hooks/useExtensionStatus';
import { PATREON_URL } from '../../lib/patreon';

const EXTENSIONS_URL = 'chrome://extensions';

export interface ExtensionNoticeProps {
  status: ExtensionStatus;
  version?: string;
}

/** The cases from H5. A banner saying "everything is fine" would be noise, so
 * `connected` does not get a status card — it gets the support ask instead,
 * which is the one thing worth saying to someone whose setup already works. */
export function ExtensionNotice({ status }: ExtensionNoticeProps) {
  const [copied, setCopied] = useState(false);

  // Nothing is known yet, so say nothing.
  if (status === 'checking') return null;
  if (status === 'connected') return <SupportCard />;

  const copyExtensionsUrl = async () => {
    try {
      await navigator.clipboard.writeText(EXTENSIONS_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: '14px 16px',
    }}>
      {status === 'notInstalled' && (
        <>
          <h2 style={h2}>Extension not installed</h2>
          <p style={body}>
            Capture happens in the browser, so SnapRec needs the Chrome
            extension. Your library stays available either way.
          </p>
          <a href="https://chrome.google.com/webstore" style={primaryLink}>Add to Chrome</a>
        </>
      )}

      {status === 'notResponding' && (
        <>
          <h2 style={h2}>Extension installed but not responding</h2>
          <p style={body}>
            It may be disabled, or blocked on this page. Check it in{' '}
            <code style={code}>{EXTENSIONS_URL}</code>, then reload this tab.
          </p>
          {/* Not an <a href>: Chrome blocks navigation to chrome:// from a web
              page and does so silently, so a link would look broken. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={copyExtensionsUrl} style={secondaryButton}>
              Copy {EXTENSIONS_URL}
            </button>
            <span role="status" aria-live="polite" style={{
              fontFamily: 'var(--sr-font-mono)', fontSize: 10,
              color: 'var(--sr-green)',
            }}>{copied ? 'Copied' : ''}</span>
          </div>
        </>
      )}

      {status === 'unsupported' && (
        <>
          <h2 style={h2}>This browser can&apos;t run the extension</h2>
          <p style={body}>
            Safari and Firefox aren&apos;t supported yet. You can still watch,
            comment on and download captures here.
          </p>
        </>
      )}
    </section>
  );
}

/** The slot the install prompt used to own. Once the extension is in place
 * there is nothing to instruct, so the space asks for support instead — the
 * quiet version of the ask, not a coral call to action. */
function SupportCard() {
  return (
    <section style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: '14px 16px',
    }}>
      <h2 style={h2}>Help keep SnapRec free</h2>
      <p style={body}>
        Recording, hosting and sharing all cost something to run. There is no
        paid tier and no watermark — a few pounds a month from people who use it
        is what keeps it that way.
      </p>
      <a href={PATREON_URL} target="_blank" rel="noopener" style={primaryLink}>
        Support us on Patreon
      </a>
    </section>
  );
}

const h2 = {
  margin: 0,
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--sr-text-primary-on-light)',
} as const;

const body = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.55,
  color: 'var(--sr-text-muted-on-light)',
  maxWidth: '62ch',
} as const;

const code = {
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 11.5,
  color: 'var(--sr-text-primary-on-light)',
} as const;

const primaryLink = {
  alignSelf: 'flex-start',
  height: 'var(--sr-h-2xs)',
  padding: '0 14px',
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--sr-text-primary-on-light)',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 600,
  textDecoration: 'none',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const secondaryButton = {
  height: 'var(--sr-h-2xs)',
  padding: '0 13px',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 12.5,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;
