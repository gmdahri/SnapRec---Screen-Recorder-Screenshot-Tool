import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimPanel, type ClaimableCapture } from '../ClaimCaptures';

const captures: ClaimableCapture[] = [
  { id: 'c1', title: 'Sprint demo walkthrough', meta: '2:14 · recorded 8 min ago', kind: 'recording' },
  { id: 'c2', title: 'Checkout bug — step 3', meta: '0:41 · recorded 2 h ago', kind: 'recording' },
  { id: 'c3', title: 'Pricing table markup', meta: 'Screenshot · yesterday', kind: 'screenshot' },
];

const mount = (onClaim = vi.fn()) =>
  render(<ClaimPanel captures={captures} email="maya@northlight.co"
    onClaim={onClaim} onSkip={() => {}} />);

describe('claim guest captures (A3)', () => {
  it('names who is signed in', () => {
    mount();
    expect(screen.getByText(/Signed in as maya@northlight.co/)).toBeInTheDocument();
  });

  it('selects everything by default — the common case is claim all', () => {
    mount();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeChecked();
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
  });

  it('lets individual captures be deselected', async () => {
    mount();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pricing table markup' }));
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
  });

  it('says exactly what happens to what is skipped', () => {
    mount();
    expect(screen.getByText(/stays on this device for 7 days and then expires/)).toBeInTheDocument();
    expect(screen.getByText(/You\s+can claim it later from the extension/)).toBeInTheDocument();
  });

  it('claims only the selected ids', async () => {
    const onClaim = vi.fn();
    mount(onClaim);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pricing table markup' }));
    await userEvent.click(screen.getByRole('button', { name: /Move 2 to my library/ }));
    expect(onClaim).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('disables the primary action when nothing is selected', async () => {
    mount();
    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box);
    expect(screen.getByRole('button', { name: /Move 0 to my library/ })).toBeDisabled();
  });
});
