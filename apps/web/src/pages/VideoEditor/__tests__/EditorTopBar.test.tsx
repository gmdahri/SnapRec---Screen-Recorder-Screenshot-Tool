import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorTopBar, type EditorTopBarProps } from '../EditorTopBar';

const base: EditorTopBarProps = {
  title: 'Follow-up for Brightline demo',
  onTitleChange: () => {},
  onBack: () => {},
  keptSec: 101,
  totalSec: 182,
  hasUnsavedChanges: false,
  saveStatus: 'idle',
  onSave: () => {},
  onExport: () => {},
  canSave: false,
};

describe('what the bar says about the edit', () => {
  it('states how much of the source survives the trim', () => {
    render(<EditorTopBar {...base} />);
    expect(screen.getByTestId('kept-summary')).toHaveTextContent('1:41 of 3:02 kept');
  });

  /** Without a known source length the phrase degrades to "0:00 of 0:00 kept",
   * which claims the edit threw everything away. */
  it('says nothing about what is kept until the source length is known', () => {
    render(<EditorTopBar {...base} totalSec={0} keptSec={0} />);
    expect(screen.queryByTestId('kept-summary')).toBeNull();
  });

  it('marks unsaved work, and only when there is some', () => {
    const { rerender } = render(<EditorTopBar {...base} hasUnsavedChanges />);
    expect(screen.getByTestId('unsaved-chip')).toHaveTextContent('unsaved');
    rerender(<EditorTopBar {...base} hasUnsavedChanges={false} />);
    expect(screen.queryByTestId('unsaved-chip')).toBeNull();
  });

  /** Coral is reserved for live capture and needs-a-response. An editor that
   * is coral for most of a working session spends that meaning on nothing. */
  it('does not spend coral on unsaved state', () => {
    render(<EditorTopBar {...base} hasUnsavedChanges />);
    const chip = screen.getByTestId('unsaved-chip');
    expect(chip.outerHTML).not.toMatch(/coral/);
  });
});

describe('the bar’s actions', () => {
  it('goes back, saves and exports', async () => {
    const onBack = vi.fn(); const onSave = vi.fn(); const onExport = vi.fn();
    const user = userEvent.setup();
    render(<EditorTopBar {...base} canSave onBack={onBack} onSave={onSave} onExport={onExport} />);

    await user.click(screen.getByRole('button', { name: 'Back to projects' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('reports progress through the save', () => {
    const { rerender } = render(<EditorTopBar {...base} canSave saveStatus="saving" />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
    rerender(<EditorTopBar {...base} canSave saveStatus="error" />);
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
  });

  it('says why saving is unavailable rather than being a dead end', () => {
    render(<EditorTopBar {...base} canSave={false} />);
    expect(screen.getByRole('button', { name: 'Save draft' }))
      .toHaveAttribute('title', 'No changes to save');
  });

  /** Publishing means replacing the video at the existing link while keeping
   * comments and view counts. That flow does not exist (plan E6.1), so the
   * button must not claim it. */
  it('offers Export, not a Publish it cannot perform', () => {
    render(<EditorTopBar {...base} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull();
  });

  it('lets the title be renamed', async () => {
    const onTitleChange = vi.fn();
    const user = userEvent.setup();
    render(<EditorTopBar {...base} title="A" onTitleChange={onTitleChange} />);
    await user.type(screen.getByLabelText('Project title'), 'B');
    expect(onTitleChange).toHaveBeenCalledWith('AB');
  });
});

describe('undo and redo (E3.1)', () => {
  it('offers both when the editor supplies them', async () => {
    const onUndo = vi.fn(); const onRedo = vi.fn();
    const user = userEvent.setup();
    render(<EditorTopBar {...base} onUndo={onUndo} onRedo={onRedo} canUndo canRedo />);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  /** A disabled control must say when it becomes available. */
  it('says why there is nothing to undo', () => {
    render(<EditorTopBar {...base} onUndo={() => {}} canUndo={false} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    expect(undo).toHaveAttribute('title', 'Nothing to undo');
  });

  it('shows neither control on a surface that cannot undo at all', () => {
    render(<EditorTopBar {...base} />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo' })).toBeNull();
  });
});

describe('publishing (E6)', () => {
  /** Export writes a file to your machine; Publish overwrites what everyone
   * holding the link already has. One label for both would hide that. */
  it('keeps Export and Publish as separate actions', async () => {
    const onExport = vi.fn(); const onPublish = vi.fn();
    const user = userEvent.setup();
    render(<EditorTopBar {...base} onExport={onExport} onPublish={onPublish} canPublish />);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Publish changes' }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it('states what publishing replaces, and what survives', () => {
    render(<EditorTopBar {...base} onPublish={() => {}} canPublish />);
    expect(screen.getByRole('button', { name: 'Publish changes' }))
      .toHaveAttribute('title', expect.stringContaining('existing link'));
  });

  /** Publishing the untouched original is a no-op that still overwrites. */
  it('refuses to publish when nothing has been applied, and says why', () => {
    render(<EditorTopBar {...base} onPublish={() => {}} canPublish={false}
      publishBlockedReason="Apply your edit first" />);
    const button = screen.getByRole('button', { name: 'Publish changes' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Apply your edit first');
  });

  it('shows progress while it runs and cannot be pressed twice', () => {
    render(<EditorTopBar {...base} onPublish={() => {}} canPublish publishStatus="publishing" />);
    expect(screen.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
  });

  /** A project with no source capture has nothing to publish over. */
  it('offers no publish control at all when there is nothing to overwrite', () => {
    render(<EditorTopBar {...base} />);
    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull();
  });
});

describe('the trailing slot', () => {
  /** VideoEditorChrome hangs the account menu and the Patreon support link here.
   * The slot itself was untested, so nothing caught a caller's content being
   * dropped — and it renders last, after Export and Publish, so it must not
   * displace them. */
  it('renders whatever the caller hangs after the primary actions', () => {
    render(<EditorTopBar {...base} trailing={<button type="button">Support us</button>} />);
    const bar = screen.getByTestId('editor-topbar');
    expect(screen.getByRole('button', { name: 'Support us' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();

    const order = [...bar.querySelectorAll('button')].map(b => b.textContent?.trim());
    expect(order.indexOf('Support us')).toBeGreaterThan(order.findIndex(t => /Export/.test(t ?? '')));
  });
});
