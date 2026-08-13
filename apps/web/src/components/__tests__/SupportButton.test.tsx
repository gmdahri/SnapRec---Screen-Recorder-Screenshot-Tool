import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportButton } from '../SupportButton';

describe('SupportButton', () => {
  it('links to the SnapRec Patreon page in a new tab', () => {
    render(<SupportButton surface="light" />);
    const link = screen.getByRole('link', { name: /Support us on Patreon/i });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('shows its label by default', () => {
    render(<SupportButton surface="light" />);
    expect(screen.getByText('Support us')).toBeInTheDocument();
  });

  it('drops the label when compact, keeping an accessible name', () => {
    render(<SupportButton surface="dark" compact />);
    expect(screen.queryByText('Support us')).toBeNull();
    expect(screen.getByRole('link', { name: /Support us on Patreon/i })).toBeInTheDocument();
  });

  it('takes its colour from the surface it sits on', () => {
    // The viewers and editors do not share a theme, so the caller states which
    // one it is — there is no context to infer it from.
    const { unmount } = render(<SupportButton surface="dark" />);
    expect(screen.getByRole('link', { name: /Support us on Patreon/i }))
      .toHaveStyle({ color: 'var(--sr-text-primary-on-dark)' });
    unmount();

    render(<SupportButton surface="light" />);
    expect(screen.getByRole('link', { name: /Support us on Patreon/i }))
      .toHaveStyle({ color: 'var(--sr-text-muted-on-light)' });
  });

  it('is never coral, which is reserved for capture and needs-a-response', () => {
    render(<SupportButton surface="dark" />);
    const style = screen.getByRole('link', { name: /Support us on Patreon/i })
      .getAttribute('style') ?? '';
    expect(style).not.toMatch(/coral/);
  });
});
