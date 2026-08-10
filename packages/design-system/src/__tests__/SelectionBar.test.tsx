import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectionBar } from '../primitives/SelectionBar';

const actions = [
  { key: 'download', label: 'Download', icon: 'ant-design:download-outlined', onSelect: () => {} },
  { key: 'move', label: 'Move to collection', icon: 'ant-design:folder-outlined', onSelect: () => {} },
];

const destructive = {
  key: 'delete', label: 'Delete', icon: 'ant-design:delete-outlined', onSelect: () => {},
};

describe('SelectionBar', () => {
  it('states the count in words', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions} destructive={destructive} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('separates the destructive action from the rest', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions} destructive={destructive} />);
    expect(screen.getByTestId('destructive-slot')).toBeInTheDocument();
  });

  it('never renders the destructive action coral-filled', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions} destructive={destructive} />);
    expect(screen.getByRole('button', { name: 'Delete' }).style.background).toBe('transparent');
  });

  it('gives a disabled bulk action its reason', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={[
      { key: 'share', label: 'Share', icon: 'ant-design:link-outlined', onSelect: () => {},
        disabledReason: '2 of these are still uploading' },
    ]} />);
    expect(screen.getByRole('button', { name: 'Share' }))
      .toHaveAttribute('title', '2 of these are still uploading');
  });

  it('clears the selection', async () => {
    const clear = vi.fn();
    render(<SelectionBar count={3} total={128} onClear={clear} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(clear).toHaveBeenCalledOnce();
  });
});
