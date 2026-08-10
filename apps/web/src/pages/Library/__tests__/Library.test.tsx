import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPopover } from '../FilterPopover';
import { EmptyState } from '../EmptyState';
import { NoResults } from '../NoResults';
import { LoadingState } from '../LoadingState';
import { initialView } from '../useLibraryView';

const filters = initialView().filters;

describe('Library filters (L3)', () => {
  it('closes on Escape', async () => {
    const close = vi.fn();
    render(<FilterPopover filters={filters} onChange={() => {}} onClose={close}
      onClearAll={() => {}} resultCount={128} collections={[]} />);
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });

  it('states how many results the current filters produce', () => {
    render(<FilterPopover filters={filters} onChange={() => {}} onClose={() => {}}
      onClearAll={() => {}} resultCount={7} collections={[]} />);
    expect(screen.getByRole('button', { name: 'Show 7 results' })).toBeInTheDocument();
  });

  it('gives every active filter its own clear control', async () => {
    const onChange = vi.fn();
    render(<FilterPopover filters={{ ...filters, type: 'recordings' }} onChange={onChange}
      onClose={() => {}} onClearAll={() => {}} resultCount={84} collections={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear type filter' }));
    expect(onChange).toHaveBeenCalledWith('type', 'all');
  });

  it('offers no clear control for a filter that is not set', () => {
    render(<FilterPopover filters={filters} onChange={() => {}} onClose={() => {}}
      onClearAll={() => {}} resultCount={128} collections={[]} />);
    expect(screen.queryByRole('button', { name: 'Clear type filter' })).toBeNull();
  });
});

describe('Library empty (L5) and no results (L6)', () => {
  it('empty offers capture', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing in your library yet')).toBeInTheDocument();
    expect(screen.getByText(/Record a tab or take a screenshot from the extension/))
      .toBeInTheDocument();
  });

  it('empty uses the registration-mark illustration, not a stock drawing', () => {
    render(<EmptyState />);
    expect(screen.getAllByTestId('registration-mark')).toHaveLength(4);
  });

  it('no-results names the cause in the heading', () => {
    render(<NoResults query="invoice pdf" activeFilters={['screenshots', 'last 7 days']}
      totalCount={128} onClearAll={() => {}} suggestions={[]} />);
    expect(screen.getByRole('heading', { name: /No screenshots from the last 7 days match "invoice pdf"/ }))
      .toBeInTheDocument();
  });

  it('no-results offers real suggestions, not a generic retry', () => {
    render(<NoResults query="invoice pdf" activeFilters={['screenshots']} totalCount={128}
      onClearAll={() => {}} suggestions={[
        { label: 'Include recordings', onSelect: () => {} },
        { label: 'Bug reports collection', onSelect: () => {} },
      ]} />);
    expect(screen.getByRole('button', { name: 'Include recordings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('the two states never share copy', () => {
    const { container: empty } = render(<EmptyState />);
    const { container: none } = render(<NoResults query="x" activeFilters={[]} totalCount={1}
      onClearAll={() => {}} suggestions={[]} />);
    expect(none.textContent).not.toContain('Nothing in your library yet');
    expect(empty.textContent).not.toBe(none.textContent);
  });
});

describe('Library loading (L7)', () => {
  it('renders skeletons in the plate geometry, never a spinner', () => {
    render(<LoadingState columns={4} />);
    expect(screen.getAllByTestId('skeleton-plate')).toHaveLength(8);
  });

  it('announces loading once, politely', () => {
    render(<LoadingState columns={4} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Loading your library');
  });
});
