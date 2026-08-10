import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { LibraryFilters } from './useLibraryView';

type FilterKey = keyof Omit<LibraryFilters, 'query'>;

export interface FilterPopoverProps {
  filters: LibraryFilters;
  onChange: (key: FilterKey, value: string | null) => void;
  onClearAll: () => void;
  onClose: () => void;
  resultCount: number;
  collections: string[];
}

const GROUPS: { key: FilterKey; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'type', label: 'Type', options: [
      { value: 'all', label: 'Everything' },
      { value: 'recordings', label: 'Recordings' },
      { value: 'screenshots', label: 'Screenshots' },
    ],
  },
  {
    key: 'sharing', label: 'Sharing', options: [
      { value: 'all', label: 'Any' },
      { value: 'shared', label: 'Shared' },
      { value: 'private', label: 'Private' },
    ],
  },
  {
    key: 'dateRange', label: 'Created', options: [
      { value: 'all', label: 'Any time' },
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
      { value: '90d', label: 'Last 90 days' },
    ],
  },
];

const DEFAULTS: Record<FilterKey, string | null> = {
  type: 'all', sharing: 'all', dateRange: 'all', collection: null,
};

export function FilterPopover({
  filters, onChange, onClearAll, onClose, resultCount, collections,
}: FilterPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  const isActive = (key: FilterKey) => filters[key] !== DEFAULTS[key];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filters"
      style={{
        position: 'absolute', zIndex: 30, width: 300, top: '100%', left: 0, marginTop: 6,
        background: 'var(--sr-surface-paper)',
        border: '1px solid var(--sr-border-light)',
        padding: 14,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {GROUPS.map(group => (
        <fieldset key={group.key} style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={legend}>
            {group.label}
            {/* Every active filter gets its own clear control — clearing all of
                them to remove one is the commonest filter frustration. */}
            {isActive(group.key) && (
              <button
                type="button"
                aria-label={`Clear ${group.key} filter`}
                onClick={() => onChange(group.key, DEFAULTS[group.key])}
                style={clearButton}
              >
                <Icon icon="ant-design:close-outlined" width={9} aria-hidden="true" />
              </button>
            )}
          </legend>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {group.options.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters[group.key] === option.value}
                onClick={() => onChange(group.key, option.value)}
                style={{
                  ...chip,
                  ...(filters[group.key] === option.value ? chipOn : null),
                }}
              >{option.label}</button>
            ))}
          </div>
        </fieldset>
      ))}

      {collections.length > 0 && (
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={legend}>
            Collection
            {isActive('collection') && (
              <button type="button" aria-label="Clear collection filter"
                onClick={() => onChange('collection', null)} style={clearButton}>
                <Icon icon="ant-design:close-outlined" width={9} aria-hidden="true" />
              </button>
            )}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {collections.map(name => (
              <button key={name} type="button"
                aria-pressed={filters.collection === name}
                onClick={() => onChange('collection', name)}
                style={{ ...chip, ...(filters.collection === name ? chipOn : null) }}
              >{name}</button>
            ))}
          </div>
        </fieldset>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        borderTop: '1px solid var(--sr-border-light-soft)', paddingTop: 12,
      }}>
        <button type="button" onClick={onClearAll} style={{ ...chip, border: 'none' }}>
          Clear all
        </button>
        <button type="button" onClick={onClose} style={{
          marginLeft: 'auto', height: 'var(--sr-h-2xs)', padding: '0 14px',
          border: 'none', background: 'var(--sr-text-primary-on-light)', color: '#fff',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          borderRadius: 'var(--sr-radius-control)',
        }}>Show {resultCount} results</button>
      </div>
    </div>
  );
}

const legend = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 10,
  letterSpacing: '.12em',
  color: 'var(--sr-text-faint-on-light)',
} as const;

const clearButton = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--sr-cyan-on-light)',
  display: 'inline-flex',
} as const;

const chip = {
  height: 26,
  padding: '0 10px',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 12,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const chipOn = {
  background: 'var(--sr-cyan-tint)',
  borderColor: 'var(--sr-cyan)',
  color: 'var(--sr-cyan-on-light)',
} as const;
