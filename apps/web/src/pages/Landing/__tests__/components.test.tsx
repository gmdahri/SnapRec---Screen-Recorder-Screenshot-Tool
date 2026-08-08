import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDemo } from '../ProductDemo';
import { ComparisonTable } from '../ComparisonTable';
import { Faq } from '../Faq';
import { MobileHero } from '../MobileHero';
import { COMPARISON, DEMO_STEPS, FAQS, MOBILE_COMPARISON } from '../copy';

describe('the product demo (M1)', () => {
  it('opens on the real product, not an empty hero', () => {
    render(<ProductDemo />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Capture');
  });

  it('carries each step body in the rail, so it reads without clicking', () => {
    render(<ProductDemo />);
    // The rail is not top tabs: every step shows its explanation at once, and
    // clicking only changes what the stage shows.
    for (const step of DEMO_STEPS) {
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }
  });

  it('switches step on click', async () => {
    render(<ProductDemo />);
    await userEvent.click(screen.getByRole('tab', { name: /Refine/ }));
    expect(screen.getByRole('tab', { name: /Refine/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('is reachable by keyboard as a tablist with roving focus', async () => {
    render(<ProductDemo />);
    screen.getByRole('tab', { name: /Capture/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Refine/ })).toHaveFocus();
  });

  it('wraps around at the end', async () => {
    render(<ProductDemo />);
    screen.getByRole('tab', { name: /Capture/ }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Share/ })).toHaveFocus();
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

describe('the landing page at 390px (M2)', () => {
  it('hides recording controls rather than disabling them', () => {
    render(<MobileHero />);
    expect(screen.queryByRole('button', { name: /Start recording/ })).toBeNull();
    // getByRole has no `disabled` filter, so query the DOM directly — the rule
    // is that nothing here is disabled, since a disabled record button on a
    // phone reads as a broken product rather than an unsupported one.
    expect(document.querySelectorAll('button[disabled], [aria-disabled="true"]')).toHaveLength(0);
  });

  it('explains where recording actually happens', () => {
    render(<MobileHero />);
    expect(screen.getByText(/Recording happens in desktop Chrome/)).toBeInTheDocument();
    expect(screen.getByText(/On phones you can watch, comment on and manage anything already captured/))
      .toBeInTheDocument();
  });

  it('puts the email path beside the Chrome button, not below the fold', () => {
    render(<MobileHero />);
    const cta = screen.getByTestId('mobile-cta');
    expect(within(cta).getByRole('link', { name: /Add to Chrome/ })).toBeInTheDocument();
    expect(within(cta).getByRole('button', { name: /Email me the link/ })).toBeInTheDocument();
  });

  it('makes every primary action at least 48px', () => {
    render(<MobileHero />);
    for (const el of document.querySelectorAll('[data-min-height]')) {
      expect(Number((el as HTMLElement).dataset.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });

  it('drops the demo to a still with a play affordance and no autoplay', () => {
    render(<MobileHero />);
    const media = screen.getByTestId('mobile-demo');
    expect(media.querySelector('video')).toBeNull();
    expect(screen.getByRole('button', { name: /Play the demo/ })).toBeInTheDocument();
  });
});
