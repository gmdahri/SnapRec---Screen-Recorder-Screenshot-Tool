import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { fetchWithAuth } from '../hooks/useRecordings';
import { AppShell, SEO } from '../components';

export type ShareVisibility = 'link' | 'restricted' | 'off';

export interface SharedCapture {
  id: string;
  title: string;
  kind: 'recording' | 'screenshot';
  visibility: ShareVisibility;
  views: number;
  commentCount: number;
  needsReply: boolean;
  lastActor: string | null;
  lastActivityAt: string;
}

const VISIBILITY_LABEL: Record<ShareVisibility, string> = {
  link: 'Anyone with the link',
  restricted: 'Only people I invite',
  off: 'you turned this link off',
};

export interface SharedListProps {
  items: SharedCapture[];
  onAction: (id: string, action: string) => void;
}

/** Sorted by obligation, not by date — the server does that, because a page
 * that buries the one unanswered question under six quiet rows is a page
 * nobody checks twice. */
export function SharedList({ items, onAction }: SharedListProps) {
  if (items.length === 0) {
    return (
      <p style={{
        margin: 0, padding: '48px 0', textAlign: 'center',
        fontSize: 13, color: 'var(--sr-text-muted-on-light)',
      }}>
        You haven&apos;t shared anything yet. Create a link from any capture in your library.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(item => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--sr-surface-paper)',
          borderLeft: `2px solid ${item.needsReply ? 'var(--sr-coral-text)' : 'transparent'}`,
          padding: '12px 14px',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 13.5, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{item.title}</h3>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 4,
              fontFamily: 'var(--sr-font-mono)', fontSize: 10,
              color: 'var(--sr-text-faint-on-light)',
            }}>
              <span>{VISIBILITY_LABEL[item.visibility]}</span>
              <span>{item.views} views</span>
              {item.commentCount > 0 && <span>{item.commentCount} comments</span>}
            </span>

            {item.needsReply && item.lastActor && (
              <span style={{
                display: 'block', marginTop: 4, fontSize: 12,
                color: 'var(--sr-text-muted-on-light)',
              }}>{item.lastActor} is waiting on a reply.</span>
            )}
          </span>

          {item.needsReply && <StatusBadge status="needs a reply" />}

          <button
            type="button"
            onClick={() => onAction(
              item.id,
              item.needsReply ? 'Open and reply'
                : item.visibility === 'off' ? 'Turn sharing on'
                : 'Copy link',
            )}
            style={{
              flex: 'none', height: 'var(--sr-h-2xs)', padding: '0 13px',
              border: '1px solid var(--sr-text-primary-on-light)', background: 'transparent',
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              borderRadius: 'var(--sr-radius-control)',
            }}
          >
            {item.needsReply ? 'Open and reply'
              : item.visibility === 'off' ? 'Turn sharing on'
              : 'Copy link'}
          </button>
        </div>
      ))}
    </div>
  );
}

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

export default function Shared() {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [direction, setDirection] = useState<'by-me' | 'with-me'>('by-me');

  const { data: items = [], isError, error } = useQuery({
    queryKey: ['recordings', 'shared', direction],
    queryFn: ({ signal }) =>
      fetchWithAuth<SharedCapture[]>(`/recordings/shared?direction=${direction}`, { signal }),
    enabled: !!user && !authLoading,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isError && error) {
      showNotification((error as Error).message || 'Failed to load shared captures', 'error');
    }
  }, [isError, error, showNotification]);

  const awaiting = items.filter(i => i.needsReply).length;

  return (
    <AppShell
      title="Shared"
      meta={`${items.length} shared by you`}
      unreadActivity={awaiting}
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      onSearch={q => navigate(`/library?q=${encodeURIComponent(q)}`)}
    >
      <SEO title="Shared — SnapRec" description="Links you have shared and what needs a reply." noIndex />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div role="tablist" aria-label="Sharing direction" style={{
          display: 'inline-flex', alignSelf: 'flex-start',
          border: '1px solid var(--sr-border-light)',
        }}>
          {([['by-me', 'Shared by you'], ['with-me', 'Shared with you']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={direction === value}
              onClick={() => setDirection(value)}
              style={{
                height: 'var(--sr-h-2xs)', padding: '0 14px', border: 'none', cursor: 'pointer',
                fontSize: 12.5,
                background: direction === value ? 'var(--sr-text-primary-on-light)' : 'transparent',
                color: direction === value ? '#fff' : 'var(--sr-text-muted-on-light)',
              }}
            >{label}</button>
          ))}
        </div>

        {direction === 'with-me' ? (
          <p style={{ margin: 0, padding: '48px 0', textAlign: 'center', fontSize: 13, color: 'var(--sr-text-muted-on-light)' }}>
            Nothing yet. Captures other people share with you will appear here.
          </p>
        ) : (
          <SharedList
            items={items}
            onAction={(id, action) => {
              if (action === 'Open and reply') return navigate(`/v/${id}`);
              if (action === 'Copy link') {
                navigator.clipboard.writeText(`${window.location.origin}/v/${id}`)
                  .then(() => showNotification('Link copied', 'success'))
                  .catch(() => showNotification('Could not copy the link', 'error'));
                return;
              }
              showNotification('Sharing controls are per capture for now', 'info');
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
