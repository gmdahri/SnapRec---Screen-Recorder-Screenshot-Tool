import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../components/Toolbar';

describe('the image editor toolbar (I1)', () => {
  it('renders all ten tools', () => {
    render(<Toolbar active="arrow" onSelect={() => {}} isApple />);
    expect(screen.getAllByRole('button')).toHaveLength(10);
  });

  it('names the shortcut on every icon-only tool button', () => {
    render(<Toolbar active="arrow" onSelect={() => {}} isApple />);
    expect(screen.getByRole('button', { name: 'Arrow' })).toHaveAttribute('title', 'Arrow — A');
    expect(screen.getByRole('button', { name: 'Blur or redact' }))
      .toHaveAttribute('title', 'Blur or redact — B');
  });

  it('marks the active tool for assistive tech, not only in cyan', () => {
    render(<Toolbar active="arrow" onSelect={() => {}} isApple />);
    expect(screen.getByRole('button', { name: 'Arrow' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Crop' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the tool that was picked', async () => {
    const onSelect = vi.fn();
    render(<Toolbar active="arrow" onSelect={onSelect} isApple />);
    await userEvent.click(screen.getByRole('button', { name: 'Blur or redact' }));
    expect(onSelect).toHaveBeenCalledWith('blur');
  });

  it('marks the tools the canvas cannot do yet rather than hiding them', () => {
    // The prototype specifies ten tools; useFabricEditor implements seven.
    // A button that quietly does nothing is worse than one that says so.
    render(<Toolbar active="arrow" onSelect={() => {}} isApple />);
    for (const label of ['Line', 'Highlight', 'Numbered step']) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button.getAttribute('title')).toMatch(/not available yet/);
    }
  });

  it('does not fire for a tool that is not available', async () => {
    const onSelect = vi.fn();
    render(<Toolbar active="arrow" onSelect={onSelect} isApple />);
    await userEvent.click(screen.getByRole('button', { name: 'Line' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
