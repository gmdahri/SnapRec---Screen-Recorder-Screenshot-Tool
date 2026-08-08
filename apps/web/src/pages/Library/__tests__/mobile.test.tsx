import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileList, type MobileItem } from '../MobileList';
import { ActionsSheet } from '../ActionsSheet';

const items: MobileItem[] = [
  { id: 'a', title: 'Checkout bug', kind: 'recording', status: 'shared', length: '0:47', created: '2h ago' },
  { id: 'b', title: 'Failed upload', kind: 'screenshot', status: 'uploadFailed', length: '—', created: '5h ago' },
  { id: 'c', title: 'Still processing', kind: 'recording', status: 'processing', length: '2:14', created: '1d ago' },
];

const noop = () => {};

describe('Library at 390px (L9)', () => {
  it('is a list, never a shrunken grid', () => {
    render(<MobileList items={items} onOpen={noop} onActions={noop} onInlineAction={noop} />);
    expect(screen.queryByTestId('capture-grid')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('keeps failures actionable inline rather than demoting them into a menu', () => {
    render(<MobileList items={items} onOpen={noop} onActions={noop} onInlineAction={noop} />);
    expect(screen.getByRole('button', { name: 'Try upload again' })).toBeInTheDocument();
  });

  it('offers no overflow on a processing row — there is nothing to do yet', () => {
    render(<MobileList items={items} onOpen={noop} onActions={noop} onInlineAction={noop} />);
    const row = screen.getByText('Still processing').closest('li')!;
    expect(row.querySelector('[data-action="overflow"]')).toBeNull();
  });

  it('gives every control at least a 44px target', () => {
    render(<MobileList items={items} onOpen={noop} onActions={noop} onInlineAction={noop} />);
    for (const b of screen.getAllByRole('button')) {
      expect(Number(b.dataset.minTarget)).toBeGreaterThanOrEqual(44);
    }
  });

  it('names each status in words', () => {
    render(<MobileList items={items} onOpen={noop} onActions={noop} onInlineAction={noop} />);
    expect(screen.getByText('shared')).toBeInTheDocument();
    expect(screen.getByText('upload failed')).toBeInTheDocument();
  });
});

describe('the actions sheet', () => {
  it('is headed by the capture so the target is unambiguous', () => {
    render(<ActionsSheet item={items[0]} onClose={noop} onSelect={noop} />);
    expect(screen.getByTestId('sheet-thumbnail')).toBeInTheDocument();
    expect(screen.getByText('Checkout bug')).toBeInTheDocument();
  });

  it('marks desktop-only actions rather than hiding them', () => {
    render(<ActionsSheet item={items[0]} onClose={noop} onSelect={noop} />);
    const edit = screen.getByRole('button', { name: /edit/i });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit.getAttribute('title')).toMatch(/desktop/i);
  });

  it('separates delete by a band', () => {
    // A shared capture has no delete — CAPTURE_STATES.shared offers
    // permissions, activity, turn-sharing-off and edit. You turn the link off
    // first. So the destructive band is tested against a ready capture.
    const ready: MobileItem = { ...items[0], status: 'ready' };
    render(<ActionsSheet item={ready} onClose={noop} onSelect={noop} />);
    expect(screen.getByRole('button', { name: /delete/i }).closest('[data-separated]')).toBeTruthy();
  });

  it('offers no delete on a shared capture — the link is turned off first', () => {
    render(<ActionsSheet item={items[0]} onClose={noop} onSelect={noop} />);
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.getByRole('button', { name: /turn sharing off/i })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const close = vi.fn();
    render(<ActionsSheet item={items[0]} onClose={close} onSelect={noop} />);
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });
});
