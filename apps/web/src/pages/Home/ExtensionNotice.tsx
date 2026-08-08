import { useState } from 'react';
import type { ExtensionStatus } from '../../hooks/useExtensionStatus';

const EXTENSIONS_URL = 'chrome://extensions';

export interface ExtensionNoticeProps {
  status: ExtensionStatus;
  version?: string;
}

/** The four cases from H5. Connected renders nothing at all — a banner saying
 * "everything is fine" is noise. */
export function ExtensionNotice({ status }: ExtensionNoticeProps) {
  const [copied, setCopied] = useState(false);

  if (status === 'connected') return null;

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
