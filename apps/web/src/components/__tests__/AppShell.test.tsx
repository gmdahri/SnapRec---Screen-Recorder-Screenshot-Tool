import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppShell } from '../AppShell';

vi.mock('../../hooks/useExtensionStatus', () => ({
  useExtensionStatus: () => ({ status: 'connected', version: '2.4' }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'priya@northlight.co' }, signOut: vi.fn() }),
}));

/** Surfaces the current path so a test can prove a control did *not* navigate. */
function Path() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

const mount = () => render(
  <MemoryRouter initialEntries={['/home']}>
    <AppShell title="Home" meta="128 captures" user={{ initials: 'PR', name: 'Priya Raman' }}
      unreadActivity={3}>
      body
      <Routes><Route path="*" element={<Path />} /></Routes>
    </AppShell>
  </MemoryRouter>,
);

/** Both the rail and the top bar render an avatar labelled with the user's
 * name; the top bar's is the last in document order. */
const avatars = () => screen.getAllByRole('button', { name: 'Priya Raman' });

describe('AppShell', () => {
  it('offers the six navigation destinations in order', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = [...nav.querySelectorAll('button[aria-label]')]
      .map(b => b.getAttribute('aria-label'))
      .filter(l => l && !/Extension|Priya/.test(l));
    expect(labels).toEqual(['Home', 'Library', 'Projects', 'Shared', 'Analytics', 'Settings']);
  });

  it('shows the page title and its count', () => {
    mount();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('128 captures')).toBeInTheDocument();
  });

  it('binds / to the search field', async () => {
    mount();
    await userEvent.keyboard('/');
    expect(screen.getByPlaceholderText('Search captures')).toHaveFocus();
  });

  it('does not steal / while the user is typing in a field', async () => {
    mount();
    const search = screen.getByPlaceholderText('Search captures');
    await userEvent.click(search);
    await userEvent.keyboard('a/b');
    expect(search).toHaveValue('a/b');
  });

  it('explains that capture happens in the extension rather than faking it', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: /New capture/ }));
    expect(screen.getByRole('dialog', { name: 'Start a capture' }))
      .toHaveTextContent('SnapRec records through the Chrome extension');
  });

  it('closes the capture popover on Escape', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: /New capture/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Start a capture' })).toBeNull();
  });

  it('names the unread activity count for assistive tech', () => {
    mount();
    expect(screen.getByRole('button', { name: /Activity/ })).toHaveAccessibleName(/3 new/);
  });

  it('renders its children', () => {
    mount();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  describe('the account menu', () => {
    /** The avatar used to navigate straight to /settings, which meant there was
     * no way to reach sign-out and the chevron on the button was a lie. */
    it('opens from the top bar avatar instead of navigating to Settings', async () => {
      mount();
      const avatar = avatars().at(-1)!;
      expect(avatar).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(avatar);

      expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/home');
      expect(avatars().at(-1)!).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens from the rail avatar too', async () => {
      mount();
      await userEvent.click(avatars()[0]);
      expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/home');
    });

    it('offers a way to sign out, which the dashboard had nowhere else', async () => {
      mount();
      await userEvent.click(avatars().at(-1)!);
      expect(screen.getByRole('menuitem', { name: /Sign out/i })).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      mount();
      await userEvent.click(avatars().at(-1)!);
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu', { name: 'Account' })).toBeNull();
    });
  });
});
