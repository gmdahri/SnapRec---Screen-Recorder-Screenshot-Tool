import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewsChart } from '../Analytics/ViewsChart';
import { AnalyticsEmpty } from '../Analytics/AnalyticsEmpty';

const data = Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1} Jul`, views: i }));

describe('Analytics', () => {
  it('renders exactly one chart', () => {
    render(<ViewsChart data={data} />);
    expect(screen.getAllByRole('img', { name: /views/i })).toHaveLength(1);
  });

  it('gives the chart a table equivalent rather than relying on shape alone', () => {
    render(<ViewsChart data={data} />);
    expect(screen.getByRole('table', { name: /views per day/i })).toBeInTheDocument();
  });

  it('labels every bar with its date and count', () => {
    render(<ViewsChart data={data} />);
    expect(screen.getByTitle('1 Jul · 0 views')).toBeInTheDocument();
    expect(screen.getByTitle('30 Jul · 29 views')).toBeInTheDocument();
  });

  it('marks only the latest bar in cyan', () => {
    render(<ViewsChart data={data} />);
    const bars = screen.getAllByTestId('views-bar');
    expect(bars.at(-1)!.style.background).toBe('var(--sr-cyan)');
    expect(bars[0].style.background).not.toBe('var(--sr-cyan)');
  });

  it('says there is nothing to measure rather than showing zeroes', () => {
    render(<AnalyticsEmpty onGoToLibrary={() => {}} />);
    expect(screen.getByText('No analytics yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to library' })).toBeInTheDocument();
  });
});
