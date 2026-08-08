import { COMPARISON_CHECKED, type ComparisonRow } from './copy';

export interface ComparisonTableProps {
  rows: ComparisonRow[];
  mobile?: boolean;
}

/** A real table with headers, not a grid of divs.
 *
 * The footnote dates the claims: a comparison table that names competitors and
 * cannot say when it was checked is not a factual claim, it is an assertion. */
export function ComparisonTable({ rows, mobile = false }: ComparisonTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <caption style={{
          captionSide: 'bottom', marginTop: 10, textAlign: 'left',
          fontSize: 11.5, color: 'var(--sr-text-faint-on-light)',
        }}>
          Free-tier limits as published by each vendor, checked {COMPARISON_CHECKED}.
          {mobile && ' Full table on desktop.'}
        </caption>

        <thead>
          <tr>
            <th scope="col" style={th} />
            <th scope="col" style={th}>SnapRec</th>
            <th scope="col" style={th}>Loom</th>
            {!mobile && <th scope="col" style={th}>Screencastify</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map(row => (
            <tr key={row.row}>
              <th scope="row" style={{ ...td, fontWeight: 500, textAlign: 'left' }}>{row.row}</th>
              <td style={{ ...td, color: 'var(--sr-text-primary-on-light)' }}>{row.snap}</td>
              <td style={td}>{row.loom}</td>
              {!mobile && <td style={td}>{row.cast}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  borderBottom: '1px solid var(--sr-border-light)',
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 10,
  letterSpacing: '.1em',
  color: 'var(--sr-text-faint-on-light)',
  fontWeight: 400,
};

const td = {
  padding: '9px 10px',
  borderBottom: '1px solid var(--sr-border-light-soft)',
  color: 'var(--sr-text-muted-on-light)',
  verticalAlign: 'top' as const,
};
