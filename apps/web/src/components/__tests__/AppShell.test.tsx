import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';

vi.mock('../../hooks/useExtensionStatus', () => ({
  useExtensionStatus: () => ({ status: 'connected', version: '2.4' }),
}));

const mount = () => render(
  <MemoryRouter>
    <AppShell title="Home" meta="128 captures" user={{ initials: 'PR', name: 'Priya Raman' }}
      unreadActivity={3}>
      body
    </AppShell>
  </MemoryRouter>,
);

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
});
