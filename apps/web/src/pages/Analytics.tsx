import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityRow } from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordings, type Recording } from '../hooks/useRecordings';
import { AppShell, SEO } from '../components';
import { needsAttention } from '../lib/captureAdapter';
import { ViewsChart, type ViewsDatum } from './Analytics/ViewsChart';
import { AnalyticsEmpty } from './Analytics/AnalyticsEmpty';

const DAYS = 30;
const DAY_MS = 86_400_000;

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

/** Views are only known in total, not per day — the server has no time series.
 * Rather than inventing a curve, the chart shows each capture's views on the
 * day it was created, which is a real distribution even if it is not a trend.
 * When the server grows a views-by-day endpoint, this is the only thing to
 * change. */
function buildSeries(recordings: Recording[], now: number): ViewsDatum[] {
  const buckets = new Map<string, number>();

  for (let i = DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * DAY_MS);
    buckets.set(date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), 0);
  }

  for (const r of recordings) {
    const created = Date.parse(r.createdAt);
    if (now - created > DAYS * DAY_MS) continue;
    const label = new Date(created).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + r.views);
  }

  return [...buckets].map(([label, views]) => ({ label, views }));
}

export default function Analytics() {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const { data: recordings = [], isError, error } = useRecordings(!!user, authLoading);

  useEffect(() => {
    if (isError && error) showNotification(error.message || 'Failed to load analytics', 'error');
  }, [isError, error, showNotification]);

  const shared = useMemo(
    () => recordings.filter((r: Recording) => r.views > 0 || r.comments.length > 0),
    [recordings],
  );

  const series = useMemo(() => buildSeries(recordings, Date.now()), [recordings]);

  const awaiting = useMemo(
    () => recordings.filter((r: Recording) => needsAttention(r, user?.id)),
    [recordings, user?.id],
  );

  const top = useMemo(
    () => [...shared].sort((a, b) => b.views - a.views).slice(0, 5),
    [shared],
  );

  const shell = (children: React.ReactNode) => (
    <AppShell
      title="Analytics"
      meta="last 30 days"
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      unreadActivity={awaiting.length}
      onSearch={q => navigate(`/library?q=${encodeURIComponent(q)}`)}
    >
      <SEO title="Analytics — SnapRec" description="Who is watching, and what needs a reply." noIndex />
      {children}
    </AppShell>
  );

  if (shared.length === 0) {
    return shell(<AnalyticsEmpty onGoToLibrary={() => navigate('/library')} />);
  }

  return shell(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={sectionHeading}>Is anyone watching?</h2>
        <ViewsChart data={series} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={sectionHeading}>What needs a reply?</h2>
        {awaiting.length === 0 ? (
          <p style={quiet}>Nothing is waiting on you.</p>
        ) : awaiting.slice(0, 6).map((r: Recording) => (
          <ActivityRow
            key={r.id}
            actor={r.comments.at(-1)?.user?.fullName ?? 'Someone'}
            event={<>commented on <strong>{r.title}</strong></>}
            meta={new Date(r.comments.at(-1)?.createdAt ?? r.createdAt).toLocaleDateString()}
            needsReply
            action={{ label: 'Open and reply', onSelect: () => navigate(`/v/${r.id}`) }}
          />
        ))}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={sectionHeading}>
          Which captures are doing the work?
          <span style={{
            marginLeft: 8, fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            fontWeight: 400, color: 'var(--sr-text-faint-on-light)',
          }}>top {top.length} of {shared.length}</span>
        </h2>

        <div role="table" aria-label="Top captures">
          <div role="row" style={{ ...row, color: 'var(--sr-text-faint-on-light)' }}>
            <span role="columnheader">Capture</span>
            <span role="columnheader">Views</span>
            <span role="columnheader">Comments</span>
            <span role="columnheader">Reactions</span>
          </div>
          {top.map((r: Recording) => (
            <div key={r.id} role="row" style={row}>
              <span role="cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </span>
              <span role="cell" style={mono}>{r.views}</span>
              <span role="cell" style={mono}>{r.comments.length || '—'}</span>
              <span role="cell" style={mono}>{r.reactions.length || '—'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>,
  );
}

const sectionHeading = {
  margin: 0,
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-.01em',
} as const;

const quiet = {
  margin: 0,
  fontSize: 12.5,
  color: 'var(--sr-text-muted-on-light)',
} as const;

const row = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 3fr) 70px 90px 90px',
  gap: 12,
  alignItems: 'center',
  height: 'var(--sr-h-row)',
  padding: '0 12px',
  borderBottom: '1px solid var(--sr-border-light-soft)',
  fontSize: 13,
} as const;

const mono = {
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 11,
  color: 'var(--sr-text-muted-on-light)',
} as const;
