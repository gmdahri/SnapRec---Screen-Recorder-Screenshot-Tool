import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  CAPTURE_STATES, CapturePlate, CaptureRow, SelectionBar,
} from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useDeleteRecording, useRecordings, type Recording } from '../hooks/useRecordings';
import { AppShell, SEO } from '../components';
import { gridColumns, rowColumns, useBreakpoint } from '../hooks/useBreakpoint';
import {
  captureHref, capturePreviewUrl, formatDuration, formatMeta, toCaptureKind, toCaptureStatus,
} from '../lib/captureAdapter';
import {
  activeFilterChips, applyFilters, initialView, reduce, selectionCapability,
  type LibraryItem,
} from './Library/useLibraryView';
import { FilterPopover } from './Library/FilterPopover';
import { FilterSheet } from './Library/FilterSheet';
import { MobileList, type MobileItem } from './Library/MobileList';
import { ActionsSheet } from './Library/ActionsSheet';
import { EmptyState } from './Library/EmptyState';
import { NoResults } from './Library/NoResults';
import { LoadingState } from './Library/LoadingState';

function toLibraryItem(r: Recording): LibraryItem {
  return {
    id: r.id,
    title: r.title,
    kind: toCaptureKind(r),
    status: toCaptureStatus(r),
    createdAt: Date.parse(r.createdAt),
    sizeBytes: 0,
    collection: null,
  };
}

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

export default function Library() {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, dispatch] = useReducer(reduce, undefined, initialView);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);

  const { data: recordings = [], isLoading, isError, error } =
    useRecordings(!!user, authLoading);
  const deleteRecording = useDeleteRecording();

  useEffect(() => {
    if (isError && error) showNotification(error.message || 'Failed to load recordings', 'error');
  }, [isError, error, showNotification]);

  // The query lives in the URL so it survives reload and can be shared.
  const query = searchParams.get('q') ?? '';
  useEffect(() => {
    dispatch({ type: 'SET_QUERY', value: query });
  }, [query]);

  const items = useMemo(() => recordings.map(toLibraryItem), [recordings]);
  const visible = useMemo(() => applyFilters(items, view.filters), [items, view.filters]);
  const byId = useMemo(() => new Map(recordings.map(r => [r.id, r])), [recordings]);

  const chips = activeFilterChips(view.filters);
  const capability = selectionCapability(items, view.selected);
  const columns = gridColumns(breakpoint) || 1;
  const mobile = breakpoint === 'mobile';
  // Below 768 the list is the only view — a two-up grid gives unreadable plates.
  const mode = mobile ? 'list' : view.mode;

  const shell = (children: React.ReactNode) => (
    <AppShell
      title="Library"
      meta={`${visible.length} of ${items.length} items`}
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      searchDefault={query}
      onSearch={q => setSearchParams(q ? { q } : {}, { replace: true })}
    >
      <SEO title="Library — SnapRec" description="Every capture you have made." noIndex />
      {children}
    </AppShell>
  );

  if (isLoading) return shell(<LoadingState columns={columns} />);
  if (items.length === 0) return shell(<EmptyState />);

  const clearAll = () => {
    dispatch({ type: 'CLEAR_FILTERS' });
    setSearchParams({}, { replace: true });
  };

  return shell(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {view.selected.size > 0 ? (
        <SelectionBar
          count={view.selected.size}
          total={items.length}
          onClear={() => dispatch({ type: 'CLEAR_SELECTION' })}
          actions={[
            {
              key: 'download', label: 'Download', icon: 'ant-design:download-outlined',
              onSelect: () => showNotification('Preparing your download', 'info'),
              disabledReason: capability.canDownload === true ? undefined : capability.canDownload,
            },
            {
              key: 'share', label: 'Share', icon: 'ant-design:link-outlined',
              onSelect: () => showNotification('Sharing is per capture for now', 'info'),
              disabledReason: capability.canShare === true ? undefined : capability.canShare,
            },
          ]}
          destructive={{
            key: 'delete', label: 'Delete', icon: 'ant-design:delete-outlined',
            onSelect: () => {
              const ids = [...view.selected];
              if (!confirm(`Delete ${ids.length} capture${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
              ids.forEach(id => deleteRecording.mutate(id));
              dispatch({ type: 'CLEAR_SELECTION' });
            },
            disabledReason: capability.canDelete === true ? undefined : capability.canDelete,
          }}
        />
      ) : (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div role="tablist" aria-label="Capture type" style={{ display: 'inline-flex', border: '1px solid var(--sr-border-light)' }}>
            {(['all', 'recordings', 'screenshots'] as const).map(value => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view.filters.type === value}
                onClick={() => dispatch({ type: 'SET_FILTER', key: 'type', value })}
                style={{
                  height: 'var(--sr-h-2xs)', padding: '0 12px', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, textTransform: 'capitalize',
                  background: view.filters.type === value ? 'var(--sr-text-primary-on-light)' : 'transparent',
                  color: view.filters.type === value ? '#fff' : 'var(--sr-text-muted-on-light)',
                }}
              >{value === 'all' ? 'Everything' : value}</button>
            ))}
          </div>

          <button type="button" onClick={() => setFiltersOpen(o => !o)} style={toolbarButton}>
            <Icon icon="ant-design:filter-outlined" width={13} aria-hidden="true" />
            Filters{chips.length > 0 ? ` · ${chips.length}` : ''}
          </button>

          {filtersOpen && !mobile && (
            <FilterPopover
              filters={view.filters}
              collections={[]}
              resultCount={visible.length}
              onChange={(key, value) => dispatch({ type: 'SET_FILTER', key, value })}
              onClearAll={clearAll}
              onClose={() => setFiltersOpen(false)}
            />
          )}

          {!mobile && (
            <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
              {(['grid', 'list'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={view.mode === m}
                  aria-label={`${m} view`}
                  onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
                  style={{
                    ...toolbarButton,
                    padding: '0 10px',
                    background: view.mode === m ? 'var(--sr-cyan-tint)' : 'transparent',
                    borderColor: view.mode === m ? 'var(--sr-cyan)' : 'var(--sr-border-light)',
                  }}
                >
                  <Icon icon={m === 'grid' ? 'ant-design:appstore-outlined' : 'ant-design:bars-outlined'}
                    width={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <NoResults
          query={query}
          activeFilters={chips.map(c => c.label.toLowerCase())}
          totalCount={items.length}
          onClearAll={clearAll}
          suggestions={view.filters.type !== 'all'
            ? [{ label: 'Include everything', onSelect: () => dispatch({ type: 'SET_FILTER', key: 'type', value: 'all' }) }]
            : []}
        />
      ) : mobile ? (
        <MobileList
          items={visible.map((item): MobileItem => {
            const r = byId.get(item.id)!;
            return {
              id: item.id,
              title: item.title,
              kind: item.kind,
              status: item.status,
              length: formatDuration(r.duration) ?? '—',
              created: new Date(item.createdAt).toLocaleDateString(),
              thumbnailUrl: capturePreviewUrl(r),
            };
          })}
          onOpen={id => navigate(captureHref(toCaptureKind(byId.get(id)!), id))}
          onActions={id => setActionsFor(id)}
          onInlineAction={id => navigate(captureHref(toCaptureKind(byId.get(id)!), id))}
        />
      ) : mode === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 16,
        }}>
          {visible.map(item => {
            const r = byId.get(item.id)!;
            return (
              <CapturePlate
                key={item.id}
                title={item.title}
                meta={formatMeta(r)}
                kind={item.kind}
                status={item.status}
                duration={formatDuration(r.duration)}
                selected={view.selected.has(item.id)}
                onSelectToggle={CAPTURE_STATES[item.status].canSelect
                  ? () => dispatch({ type: 'TOGGLE_SELECT', id: item.id, status: item.status })
                  : undefined}
                onOpen={() => navigate(captureHref(item.kind, item.id))}
                media={(() => {
                  const preview = capturePreviewUrl(r);
                  return preview
                    ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : undefined;
                })()}
              />
            );
          })}
        </div>
      ) : (
        <div role="table" aria-label="Captures">
          {visible.map(item => {
            const r = byId.get(item.id)!;
            return (
              <CaptureRow
                key={item.id}
                title={item.title}
                kind={item.kind}
                length={formatDuration(r.duration) ?? '—'}
                created={new Date(item.createdAt).toLocaleDateString()}
                size="—"
                collection={item.collection ?? '—'}
                sharing={item.status === 'shared' ? 'shared' : 'private'}
                activity={`${r.views} views · ${r.comments.length} comments`}
                status={item.status}
                columns={rowColumns(breakpoint)}
                selected={view.selected.has(item.id)}
                onSelectToggle={CAPTURE_STATES[item.status].canSelect
                  ? () => dispatch({ type: 'TOGGLE_SELECT', id: item.id, status: item.status })
                  : undefined}
                onOpen={() => navigate(captureHref(item.kind, item.id))}
              />
            );
          })}
        </div>
      )}

      {filtersOpen && mobile && (
        <FilterSheet
          filters={view.filters}
          resultCount={visible.length}
          onChange={(key, value) => dispatch({ type: 'SET_FILTER', key, value })}
          onClearAll={clearAll}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {actionsFor && (() => {
        const item = visible.find(i => i.id === actionsFor);
        if (!item) return null;
        const r = byId.get(item.id)!;
        return (
          <ActionsSheet
            item={{
              id: item.id,
              title: item.title,
              kind: item.kind,
              status: item.status,
              length: formatDuration(r.duration) ?? '—',
              created: new Date(item.createdAt).toLocaleDateString(),
              thumbnailUrl: capturePreviewUrl(r),
            }}
            onClose={() => setActionsFor(null)}
            onSelect={action => {
              if (/delete/i.test(action)) {
                if (confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                  deleteRecording.mutate(item.id);
                }
                return;
              }
              navigate(captureHref(item.kind, item.id));
            }}
          />
        );
      })()}
    </div>,
  );
}

const toolbarButton = {
  height: 'var(--sr-h-2xs)',
  padding: '0 12px',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 12.5,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  borderRadius: 'var(--sr-radius-control)',
} as const;
