import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRail } from '../primitives/AppRail';

const items = [
  { key: 'home', label: 'Home', icon: 'ant-design:home-outlined', onSelect: () => {} },
  { key: 'library', label: 'Library', icon: 'ant-design:appstore-outlined', onSelect: () => {} },
];
const user = { initials: 'PR', name: 'Priya Raman' };

describe('AppRail', () => {
  it('is 68px wide by default', () => {
    render(<AppRail items={items} current="home" extension="on" user={user} />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveStyle({ width: '68px' });
  });

  it('collapses to 56px and drops labels to tooltips', () => {
    render(<AppRail items={items} current="home" extension="on" user={user} collapsed />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveStyle({ width: '56px' });
    expect(screen.queryByText('Library')).toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('title', 'Library');
  });

  it('marks the current item for assistive tech, not only in cyan', () => {
    render(<AppRail items={items} current="library" extension="on" user={user} />);
    expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('states extension connectivity in words', () => {
    const { rerender } = render(<AppRail items={items} current="home" extension="on" user={user} />);
    expect(screen.getByRole('button', { name: 'Extension on' })).toBeInTheDocument();
    rerender(<AppRail items={items} current="home" extension="off" user={user} />);
    expect(screen.getByRole('button', { name: 'Extension off' })).toBeInTheDocument();
  });

  it('navigates on click', async () => {
    const go = vi.fn();
    render(<AppRail items={[{ ...items[0], onSelect: go }]} current="library" extension="on" user={user} />);
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(go).toHaveBeenCalledOnce();
  });
});
