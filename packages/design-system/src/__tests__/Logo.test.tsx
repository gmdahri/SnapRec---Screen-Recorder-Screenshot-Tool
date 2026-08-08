import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from '../primitives/Logo';

describe('Logo', () => {
  it('renders an accessible image role with a default title', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'SnapRec' })).toBeInTheDocument();
  });

  it('renders the wordmark when asked', () => {
    const { container } = render(<Logo withWordmark />);
    expect(container.querySelector('[data-part="wordmark"]')).toHaveTextContent('SnapRec');
  });

  it('omits the visible wordmark by default', () => {
    // The SVG <title> still says "SnapRec" — that is the accessible name,
    // not visible text — so this asserts on the wordmark element itself.
    const { container } = render(<Logo />);
    expect(container.querySelector('[data-part="wordmark"]')).toBeNull();
  });

  it('draws the capture dot in coral', () => {
    const { container } = render(<Logo />);
    const dot = container.querySelector('[data-part="dot"]');
    expect(dot).toHaveAttribute('fill', 'var(--sr-coral-mark)');
  });
});
