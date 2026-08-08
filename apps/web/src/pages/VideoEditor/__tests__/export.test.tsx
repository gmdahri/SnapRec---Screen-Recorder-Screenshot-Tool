import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesModal } from '../UnsavedChangesModal';
import { ExportModal } from '../ExportModal';

const noop = () => {};

describe('leaving the editor (V4)', () => {
  const props = {
    title: 'Follow-up for Brightline demo',
    summary: 'draft edit · 1:41 of 3:02 kept · saved 12s ago',
    onLeave: noop, onDiscard: noop, onStay: noop,
  };

  it('names exactly what is kept and when it was saved', () => {
    render(<UnsavedChangesModal {...props} />);
    expect(screen.getByText('draft edit · 1:41 of 3:02 kept · saved 12s ago')).toBeInTheDocument();
  });

  it('offers leaving with the draft intact as the primary path', () => {
    render(<UnsavedChangesModal {...props} />);
    expect(screen.getByRole('button', { name: 'Leave, keep the draft' })).toBeInTheDocument();
  });

  it('separates discarding and never renders it coral-filled', () => {
    render(<UnsavedChangesModal {...props} />);
    const discard = screen.getByRole('button', { name: /Discard/ });
    expect(discard.closest('[data-separated]')).toBeTruthy();
    expect(discard.style.background).toBe('transparent');
  });

  it('names what discarding costs before it happens', () => {
    render(<UnsavedChangesModal {...props} />);
    expect(screen.getByRole('button', { name: /Discard/ }).getAttribute('title'))
      .toMatch(/cannot be undone/i);
  });

  it('closes on Escape, treating it as staying', async () => {
    const onStay = vi.fn();
    render(<UnsavedChangesModal {...props} onStay={onStay} />);
    await userEvent.keyboard('{Escape}');
    expect(onStay).toHaveBeenCalledOnce();
  });
});

describe('exporting (V5) and failing (V6)', () => {
  const handlers = { onCancel: noop, onRetry: noop, onRetryLower: noop, onBack: noop };

  it('names the frame count, not just a percentage', () => {
    render(<ExportModal state={{ kind: 'exporting', pct: 52, frame: 1284, frames: 2460 }} {...handlers} />);
    expect(screen.getByText(/frame 1284 of 2460/)).toBeInTheDocument();
  });

  it('says the export survives closing the tab', () => {
    render(<ExportModal state={{ kind: 'exporting', pct: 52, frame: 1284, frames: 2460 }} {...handlers} />);
    expect(screen.getByText(/safe to close/)).toBeInTheDocument();
  });

  it('states where it stopped and that the edit survived', () => {
    render(<ExportModal state={{ kind: 'failed', frame: 1284, frames: 2460 }} {...handlers} />);
    expect(screen.getByText(/stopped at frame 1284 of 2460/)).toBeInTheDocument();
    expect(screen.getByText(/saved to library/)).toBeInTheDocument();
  });

  it('offers a second, cheaper route as well as a plain retry', () => {
    render(<ExportModal state={{ kind: 'failed', frame: 1284, frames: 2460 }} {...handlers} />);
    expect(screen.getByRole('button', { name: 'Try export again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export at 720p instead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the editor' })).toBeInTheDocument();
  });

  it('carries a non-colour indicator alongside the coral', () => {
    render(<ExportModal state={{ kind: 'failed', frame: 1284, frames: 2460 }} {...handlers} />);
    expect(screen.getByText('export failed')).toBeInTheDocument();
  });

  it('states the edit is safe before it states the cause', () => {
    render(<ExportModal state={{ kind: 'failed', frame: 1284, frames: 2460 }} {...handlers} />);
    const body = screen.getByTestId('failure-body').textContent!;
    expect(body.indexOf('saved to library')).toBeLessThan(body.indexOf('Rendering stopped'));
  });
});
