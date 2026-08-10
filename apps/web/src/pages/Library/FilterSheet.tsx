import { BottomSheet } from '../../components/BottomSheet';
import type { LibraryFilters } from './useLibraryView';

type FilterKey = keyof Omit<LibraryFilters, 'query'>;

export interface FilterSheetProps {
  filters: LibraryFilters;
  resultCount: number;
  onChange: (key: FilterKey, value: string | null) => void;
  onClearAll: () => void;
  onClose: () => void;
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

/** Filters as a sheet with 44px rows, confirmed by a button that names the
 * outcome. Sort is a chip in the toolbar, not buried in here — hiding sort
 * inside a filter menu is how people conclude an app cannot sort. */
export function FilterSheet({
  filters, resultCount, onChange, onClearAll, onClose,
}: FilterSheetProps) {
  return (
    <BottomSheet label="Filters" onClose={onClose}>
      {GROUPS.map(group => (
        <fieldset key={group.key} style={{
          border: 'none', margin: 0, padding: '6px 18px 10px',
        }}>
          <legend style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
            padding: 0,
          }}>{group.label}</legend>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {group.options.map(option => {
              const on = filters[group.key] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-min-target="44"
                  aria-pressed={on}
                  onClick={() => onChange(group.key, option.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    minHeight: 44, border: 'none', background: 'transparent',
                    padding: '0 2px', fontSize: 14, cursor: 'pointer',
                    color: on ? 'var(--sr-cyan-on-light)' : 'var(--sr-text-primary-on-light)',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {option.label}
                  {on && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div style={{
        display: 'flex', gap: 10, padding: '12px 18px 0',
        borderTop: '1px solid var(--sr-border-light-soft)',
      }}>
        <button type="button" data-min-target="44" onClick={onClearAll} style={{
          minHeight: 44, padding: '0 14px', border: '1px solid var(--sr-border-light)',
          background: 'transparent', fontSize: 13.5, cursor: 'pointer',
          borderRadius: 'var(--sr-radius-control)',
        }}>Clear all</button>

        <button type="button" data-min-target="44" onClick={onClose} style={{
          flex: 1, minHeight: 44, border: 'none',
          background: 'var(--sr-text-primary-on-light)', color: '#fff',
          fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          borderRadius: 'var(--sr-radius-control)',
        }}>Show {resultCount} results</button>
      </div>
    </BottomSheet>
  );
}
