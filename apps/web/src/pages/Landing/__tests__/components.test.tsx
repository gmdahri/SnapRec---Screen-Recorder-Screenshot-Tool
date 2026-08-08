import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDemo } from '../ProductDemo';
import { ComparisonTable } from '../ComparisonTable';
import { Faq } from '../Faq';
import { COMPARISON, FAQS, MOBILE_COMPARISON } from '../copy';

describe('the product demo (M1)', () => {
  it('opens on the real product, not an empty hero', () => {
    render(<ProductDemo />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Capture');
  });

  it('switches step on click', async () => {
    render(<ProductDemo />);
    await userEvent.click(screen.getByRole('tab', { name: 'Refine' }));
    expect(screen.getByRole('tab', { name: 'Refine' })).toHaveAttribute('aria-selected', 'true');
  });

  it('is reachable by keyboard as a tablist with roving focus', async () => {
    render(<ProductDemo />);
    screen.getByRole('tab', { name: 'Capture' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Refine' })).toHaveFocus();
  });

  it('wraps around at the end', async () => {
    render(<ProductDemo />);
    screen.getByRole('tab', { name: 'Capture' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Share' })).toHaveFocus();
  });
});

describe('the comparison table', () => {
  it('names the source and the date it was checked', () => {
    render(<ComparisonTable rows={COMPARISON} />);
    expect(screen.getByText(/as published by each vendor, checked/)).toBeInTheDocument();
  });

  it('is a real table with headers, not a grid of divs', () => {
    render(<ComparisonTable rows={COMPARISON} />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['', 'SnapRec', 'Loom', 'Screencastify']);
  });

  it('shows two competitors and links to the full table on mobile', () => {
    render(<ComparisonTable rows={MOBILE_COMPARISON as never} mobile />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByText(/Full table on desktop/)).toBeInTheDocument();
  });
});

describe('the FAQ', () => {
  it('opens one answer at a time and toggles it closed', async () => {
    render(<Faq faqs={FAQS} />);
    const first = screen.getByRole('button', { name: /Do I need an account/ });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('says recording works without an account', () => {
    render(<Faq faqs={FAQS} />);
    expect(screen.getByText(/Recording, screenshots, annotation and downloading all work without signing in/))
      .toBeInTheDocument();
  });
});
