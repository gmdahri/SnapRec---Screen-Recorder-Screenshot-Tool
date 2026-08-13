import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageShare } from '../ImageShare';
import type { ShareComment } from '../anchors';

const capture = {
  id: 'c2', title: 'Plan selection', owner: 'Priya Raman',
  width: 2880, height: 1620, allowDownload: true,
};

const comments: ShareComment[] = [
  { id: '1', author: 'Dan', body: 'Move this up', createdAt: '', index: 1,
    anchor: { kind: 'point', x: 0.3, y: 0.4 }, needsReply: false, resolved: false },
  { id: '2', author: 'Maya', body: 'Colour is off', createdAt: '', index: 2,
    anchor: { kind: 'point', x: 0.7, y: 0.6 }, needsReply: false, resolved: false },
  { id: '3', author: 'Sam', body: 'Which build?', createdAt: '', index: 3,
    anchor: { kind: 'point', x: 0.5, y: 0.2 }, needsReply: true, resolved: false },
  { id: '4', author: 'Ana', body: 'Fixed', createdAt: '', index: 4,
    anchor: { kind: 'point', x: 0.1, y: 0.1 }, needsReply: false, resolved: true },
];

const noop = () => {};

describe('image share (C2)', () => {
  it('numbers every pin so they are distinguishable without colour', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    for (const n of ['1', '2', '3']) {
      expect(screen.getByRole('button', { name: `Pin ${n}` })).toHaveTextContent(n);
    }
  });

  it('inverts the pin and fills the note when a pin is selected', async () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin 2' }));
    expect(screen.getByRole('button', { name: 'Pin 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('note-2').dataset.selected).toBe('true');
  });

  it('draws leaders when the margin is wide enough', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    expect(screen.getAllByTestId('leader').length).toBeGreaterThan(0);
  });

  it('drops leaders entirely below 300px of margin', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={280} onPost={noop} />);
    expect(screen.queryAllByTestId('leader')).toHaveLength(0);
  });

  it('collapses resolved comments under a count', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    expect(screen.getByRole('button', { name: '1 resolved' })).toBeInTheDocument();
    expect(screen.queryByText('Fixed')).toBeNull();
  });

  it('drops a resolved pin to a faint outline rather than removing it', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    expect(screen.getByRole('button', { name: 'Pin 4' })).toHaveAttribute('data-resolved', 'true');
  });

  it('marks the needs-a-reply pin without relying on colour', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    expect(screen.getByRole('button', { name: 'Pin 3' })).toHaveAttribute('data-needs-reply', 'true');
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('places a new pin where the image was clicked, normalised', async () => {
    const onPost = vi.fn();
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={onPost} />);

    const canvas = screen.getByTestId('image-canvas');
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 800, height: 450, right: 800, bottom: 450, x: 0, y: 0,
      toJSON: () => ({}),
    });

    // fireEvent, not userEvent: userEvent.pointer does not carry its coords
    // into a subsequent click, so clientX/clientY arrive as 0 and the
    // normalisation under test never runs.
    fireEvent.click(canvas, { clientX: 200, clientY: 225 });
    await userEvent.type(screen.getByRole('textbox', { name: /comment/i }), 'Here');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ anchorX: 0.25, anchorY: 0.5 }));
  });
});

describe('the support ask on a shared screenshot', () => {
  /** The viewers are public pages, so this reaches recipients rather than the
   * owner. It stays outlined and secondary for that reason — it must not compete
   * with Download on someone else's content. */
  it('offers a Patreon link in the header', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={noop} />);
    const link = screen.getByRole('link', { name: /Support us on Patreon/i });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('keeps it available even when downloads are switched off', () => {
    render(
      <ImageShare capture={{ ...capture, allowDownload: false }} comments={comments}
        marginPx={360} onPost={noop} />,
    );
    expect(screen.getByRole('link', { name: /Support us on Patreon/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});
