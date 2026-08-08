export interface NoResultsProps {
  query: string;
  /** Human-readable descriptions of the active filters, e.g. ['screenshots']. */
  activeFilters: string[];
  totalCount: number;
  onClearAll: () => void;
  suggestions: { label: string; onSelect: () => void }[];
}

/** Builds a heading that names the cause rather than implying it.
 * "No screenshots from the last 7 days match "invoice pdf"" tells the user
 * which constraint to relax; "No results" does not. */
function heading(query: string, activeFilters: string[]): string {
  const subject = activeFilters.length > 0 ? activeFilters.join(' from the ') : 'captures';
  return query
    ? `No ${subject} match "${query}"`
    : `No ${subject} to show`;
}

/** L6 — a query that found nothing. Never shares copy with EmptyState. */
export function NoResults({
  query, activeFilters, totalCount, onClearAll, suggestions,
}: NoResultsProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 14, padding: '56px 20px', textAlign: 'center',
    }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.02em', maxWidth: '48ch' }}>
        {heading(query, activeFilters)}
      </h2>

      <p style={{
        margin: 0, fontSize: 13, lineHeight: 1.6,
        color: 'var(--sr-text-muted-on-light)',
      }}>
        You have {totalCount} captures in total. Widening the filters usually finds it.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        <button type="button" onClick={onClearAll} style={action}>Clear all filters</button>
        {/* Real, specific next moves — not a generic "try again". */}
        {suggestions.map(s => (
          <button key={s.label} type="button" onClick={s.onSelect} style={action}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

const action = {
  height: 'var(--sr-h-2xs)',
  padding: '0 13px',
  border: '1px solid var(--sr-border-light)',
  background: 'transparent',
  fontSize: 12.5,
  cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;
