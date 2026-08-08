import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { icons } from '../icons';

describe('Button', () => {
  it('defaults to the 34px control height', () => {
    render(<Button>Save to library</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ height: 'var(--sr-h-sm)' });
  });

  it('uses coral only for the capture variant', () => {
    const { rerender } = render(<Button variant="capture">Start recording</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--sr-coral-text)' });

    rerender(<Button variant="primary">Upload and get link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--sr-cyan)' });
  });

  it('puts cyan-safe foreground on the primary fill', () => {
    render(<Button variant="primary">Upload and get link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ color: 'var(--sr-cyan-fg)' });
  });

  it('applies the 2px control radius, never a larger one', () => {
    render(<Button>Copy link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ borderRadius: 'var(--sr-radius-control)' });
  });
});

describe('IconButton', () => {
  it('requires and exposes an accessible name', () => {
    render(<IconButton icon={icons.pause} label="Pause" />);
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('title', 'Pause');
  });
});
