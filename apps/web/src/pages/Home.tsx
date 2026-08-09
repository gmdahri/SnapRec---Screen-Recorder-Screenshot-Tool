import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapturePlate } from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordings, type Recording } from '../hooks/useRecordings';
import { AppShell, SEO } from '../components';
import { useBreakpoint, gridColumns } from '../hooks/useBreakpoint';
import { useExtensionStatus } from '../hooks/useExtensionStatus';
import {
  captureHref, formatDuration, formatMeta, needsAttention, toCaptureKind, toCaptureStatus,
} from '../lib/captureAdapter';
import { AttentionBand, type AttentionItem } from './Home/AttentionBand';
import { InProgress, type InProgressItem } from './Home/InProgress';
import { ExtensionNotice } from './Home/ExtensionNotice';
import { NewUser } from './Home/NewUser';

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const { status: extensionStatus, version } = useExtensionStatus();

  const { data: recordings = [], isError, error } = useRecordings(!!user, authLoading);

  useEffect(() => {
    if (isError && error) showNotification(error.message || 'Failed to load recordings', 'error');
  }, [isError, error, showNotification]);

  const ownerId = user?.id;

  const attention: AttentionItem[] = useMemo(() => recordings
    .filter((r: Recording) => needsAttention(r, ownerId))
    .slice(0, 4)
    .map((r: Recording) => ({
      id: r.id,
      kind: 'needsReply' as const,
      title: r.title,
      detail: `${r.comments.length} comment${r.comments.length === 1 ? '' : 's'}, newest still unanswered.`,
      action: { label: 'Open and reply', onSelect: () => navigate(`/v/${r.id}`) },
    })), [recordings, ownerId, navigate]);

  const inProgress: InProgressItem[] = useMemo(() => recordings
    .filter((r: Recording) => toCaptureStatus(r) === 'processing')
    .map((r: Recording) => ({
      id: r.id,
      title: r.title,
      status: 'processing' as const,
      detail: 'processing · usually under a minute',
      action: { label: 'Copy link', onSelect: () => navigate(`/v/${r.id}`) },
    })), [recordings, navigate]);

  const recent = recordings.slice(0, gridColumns(breakpoint) || 2);
  const columns = gridColumns(breakpoint) || 2;

  const shell = (children: React.ReactNode) => (
    <AppShell
      title="Home"
      meta={recordings.length ? `${recordings.length} captures` : 'no captures yet'}
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      unreadActivity={attention.length}
      onSearch={q => navigate(`/library?q=${encodeURIComponent(q)}`)}
    >
      <SEO title="Home — SnapRec" description="Your recent captures, activity and work in progress." noIndex />
      {children}
    </AppShell>
  );

  // H2: a brand-new account gets the explainer, not five empty sections.
  if (recordings.length === 0) {
    return shell(<NewUser extensionStatus={extensionStatus} onGoToLibrary={() => navigate('/library')} />);
  }

  return shell(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <AttentionBand items={attention} />
      <ExtensionNotice status={extensionStatus} version={version} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
          }}>Recent captures</span>
          <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
          <button type="button" onClick={() => navigate('/library')} style={{
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontFamily: 'var(--sr-font-mono)', fontSize: 10, color: 'var(--sr-cyan-on-light)',
          }}>all {recordings.length} →</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 14,
        }}>
          {recent.map((r: Recording) => (
            <CapturePlate
              key={r.id}
              title={r.title}
              meta={formatMeta(r)}
              kind={toCaptureKind(r)}
              status={toCaptureStatus(r)}
              duration={formatDuration(r.duration)}
              onOpen={() => navigate(captureHref(toCaptureKind(r), r.id))}
              media={r.thumbnailUrl
                ? <img src={r.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : undefined}
              footnotes={r.views > 0
                ? <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 9.5, color: 'var(--sr-text-faint-on-light)' }}>
                    {r.views} views
                  </span>
                : undefined}
            />
          ))}
        </div>
      </section>

      <InProgress items={inProgress} />

      {/* A phone browser cannot run the extension, so mobile explains what it
          is for rather than offering a capture button that cannot work. */}
      {breakpoint === 'mobile' && (
        <p style={{
          margin: 0, fontSize: 12.5, lineHeight: 1.55,
          color: 'var(--sr-text-muted-on-light)',
        }}>
          Recording happens in desktop Chrome. On your phone you can watch,
          comment on and manage anything you have already captured.
        </p>
      )}
    </div>,
  );
}
