import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '../AccountMenu';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const signOut = vi.fn();

vi.mock('../../hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'priya@northlight.co' }, signOut }),
}));

const user = { initials: 'PR', name: 'Priya Raman' };

const mount = (onClose = vi.fn(), onNavigate = vi.fn()) => {
  render(<AccountMenu user={user} onClose={onClose} onNavigate={onNavigate} />);
  return { onClose, onNavigate };
};

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue('desktop');
    signOut.mockClear();
  });

  it('identifies whose account it is', () => {
    mount();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('priya@northlight.co')).toBeInTheDocument();
  });

  it('signs the user out and closes', async () => {
    const { onClose } = mount();
    await userEvent.click(screen.getByRole('menuitem', { name: /Sign out/i }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to Settings through its callback rather than navigating itself', async () => {
    const { onNavigate } = mount();
    await userEvent.click(screen.getByRole('menuitem', { name: /Settings/i }));
    expect(onNavigate).toHaveBeenCalledWith('/settings');
  });

  it('closes on Escape', async () => {
    const { onClose } = mount();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a click outside itself', async () => {
    const { onClose } = mount();
    await userEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('reaches Projects on mobile, which the bottom bar drops', () => {
    vi.mocked(useBreakpoint).mockReturnValue('mobile');
    mount();
    // MOBILE_NAV filters out projects and settings, and nothing else offers
    // them — so the sheet is the only route to either.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/i })).toBeInTheDocument();
  });
});
