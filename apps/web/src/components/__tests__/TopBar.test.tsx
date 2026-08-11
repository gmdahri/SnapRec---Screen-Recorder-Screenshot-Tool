import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from '../TopBar';
import { useBreakpoint } from '../../hooks/useBreakpoint';

vi.mock('../../hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

const user = { initials: 'PR', name: 'Priya Raman' };

const mount = () => render(
  <TopBar title="Home" user={user} onNewCapture={() => {}} />,
);

describe('TopBar Patreon link', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue('desktop');
  });

  it('links to the SnapRec Patreon page in a new tab', () => {
    mount();
    const link = screen.getByRole('link', { name: /Support us on Patreon/ });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('shows the "Support us" label at desktop width', () => {
    mount();
    expect(screen.getByText('Support us')).toBeInTheDocument();
  });

  it('collapses to icon-only on mobile, keeping an accessible name', () => {
    vi.mocked(useBreakpoint).mockReturnValue('mobile');
    mount();
    expect(screen.queryByText('Support us')).toBeNull();
    expect(screen.getByRole('link', { name: /Support us on Patreon/ })).toBeInTheDocument();
  });
});
