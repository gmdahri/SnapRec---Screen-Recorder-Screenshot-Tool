import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CAPTURE_STATES, StatusBadge, type StatusWord } from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { useClaimRecordings, useRecordings, type Recording } from '../hooks/useRecordings';
import { SEO } from '../components';
import { decodeReturnTo } from '../lib/returnTo';
import { formatMeta, toCaptureKind } from '../lib/captureAdapter';

export interface ClaimableCapture {
  id: string;
  title: string;
  meta: string;
  kind: 'recording' | 'screenshot';
}

export interface ClaimPanelProps {
  captures: ClaimableCapture[];
  email: string;
  onClaim: (ids: string[]) => void;
  onSkip: () => void;
}

/** A3 — claiming guest captures.
 *
 * Everything is selected by default because claiming all of them is the common
 * case; deselecting is the exception. And what happens to anything skipped is
 * stated outright — "stays on this device for 7 days and then expires" is the
 * fact people need to decide, and hiding it would make the default feel like a
 * trick. */
export function ClaimPanel({ captures, email, onClaim, onSkip }: ClaimPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(captures.map(c => c.id)),
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main style={{
      maxWidth: 520, width: '100%',
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: 26,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <span style={{
        fontFamily: 'var(--sr-font-mono)', fontSize: 10,
        color: 'var(--sr-text-faint-on-light)',
      }}>Signed in as {email}</span>

      <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>
        Move these into your library?
      </h1>

      <span style={{
        fontFamily: 'var(--sr-font-mono)', fontSize: 10.5,
        color: 'var(--sr-text-faint-on-light)',
      }}>{selected.size} of {captures.length} selected</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {captures.map(capture => {
          const on = selected.has(capture.id);
          return (
            <label
              key={capture.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', cursor: 'pointer',
                background: on ? 'var(--sr-cyan-tint)' : 'transparent',
                border: `1px solid ${on ? 'var(--sr-cyan)' : 'var(--sr-border-light-soft)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(capture.id)}
                aria-label={capture.title}
                style={{ accentColor: 'var(--sr-cyan)' }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{capture.title}</span>
                <span style={{
                  display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                  color: 'var(--sr-text-faint-on-light)',
                }}>{capture.meta}</span>
              </span>
              <StatusBadge status={CAPTURE_STATES.localOnly.label as StatusWord} />
            </label>
          );
        })}
      </div>

      <p style={{
        margin: 0, fontSize: 12.5, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        Anything you skip stays on this device for 7 days and then expires. You
        can claim it later from the extension.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onClaim([...selected])}
          style={{
            flex: 1, height: 'var(--sr-h-md)', border: 'none',
            background: 'var(--sr-text-primary-on-light)', color: '#fff',
            fontSize: 13.5, fontWeight: 600,
            cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            opacity: selected.size === 0 ? 0.5 : 1,
            borderRadius: 'var(--sr-radius-control)',
          }}
        >Move {selected.size} to my library</button>

        <button type="button" onClick={onSkip} style={{
          height: 'var(--sr-h-md)', padding: '0 16px',
          border: '1px solid var(--sr-border-light)', background: 'transparent',
          fontSize: 13.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
        }}>Not now</button>
      </div>
    </main>
  );
}

/** The page. Lists captures this browser made while signed out and offers to
 * move them into the account that just signed in. */
export default function ClaimCaptures() {
  const { user, guestId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claim = useClaimRecordings();

  const { data: recordings = [] } = useRecordings(!!user, false);

  // Anything still attributed to this guest rather than to the account.
  const claimable: ClaimableCapture[] = recordings
    .filter((r: Recording & { guestId?: string | null }) => r.guestId && r.guestId === guestId)
    .map((r: Recording) => ({
      id: r.id,
      title: r.title,
      meta: formatMeta(r),
      kind: toCaptureKind(r) === 'recording' ? 'recording' : 'screenshot',
    }));

  const returnTo = decodeReturnTo(searchParams.get('returnTo'));

  // Nothing to claim: skip the interstitial rather than showing an empty one.
  useEffect(() => {
    if (claimable.length === 0) navigate(returnTo, { replace: true });
  }, [claimable.length, navigate, returnTo]);

  if (claimable.length === 0) return null;

  return (
    <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased flex justify-center px-6 py-16">
      <SEO title="Claim your captures — SnapRec" description="Move guest captures into your library." noIndex />
      <ClaimPanel
        captures={claimable}
        email={user?.email ?? ''}
        onClaim={ids => claim.mutate(ids, { onSuccess: () => navigate(returnTo, { replace: true }) })}
        onSkip={() => navigate(returnTo, { replace: true })}
      />
    </div>
  );
}
