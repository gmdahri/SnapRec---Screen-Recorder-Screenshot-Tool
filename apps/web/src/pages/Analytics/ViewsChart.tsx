export interface ViewsDatum {
  label: string;
  views: number;
}

/** The one chart on the page.
 *
 * Thirty bars need no charting library, and a dependency here would be the
 * largest thing on a page that answers two questions. The <table> is not a
 * fallback — it is the accessible equivalent, always present and visually
 * hidden, because a bar chart's shape is not readable by everyone. */
export function ViewsChart({ data }: { data: ViewsDatum[] }) {
  const max = Math.max(1, ...data.map(d => d.views));

  return (
    <div>
      <div
        role="img"
        aria-label={`Views per day for the last ${data.length} days`}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 3,
          height: 120, padding: '0 2px',
        }}
      >
        {data.map((d, i) => (
          <span
            key={d.label}
            data-testid="views-bar"
            title={`${d.label} · ${d.views} views`}
            style={{
              flex: 1,
              minWidth: 0,
              height: `${Math.max(2, (d.views / max) * 100)}%`,
              // Only the newest bar is cyan: it is the one the reader is
              // actually asking about.
              background: i === data.length - 1
                ? 'var(--sr-cyan)'
                : 'var(--sr-text-primary-on-light)',
            }}
          />
        ))}
      </div>

      <table aria-label="Views per day, last 30 days" style={visuallyHidden}>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">Views</th></tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
