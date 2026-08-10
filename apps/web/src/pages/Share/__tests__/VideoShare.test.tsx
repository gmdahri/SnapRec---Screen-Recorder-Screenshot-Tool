import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoShare } from '../VideoShare';
import type { ShareComment } from '../anchors';

const capture = {
  id: 'c1', title: 'Checkout bug repro', owner: 'Priya Raman',
  durationMs: 47_000, allowDownload: true,
};

const comments: ShareComment[] = [
  { id: '1', author: 'Dan Keller', body: 'Repros for me', createdAt: '', index: 1,
    anchor: { kind: 'timecode', ms: 11_000 }, needsReply: false, resolved: false },
  { id: '2', author: 'Maya Osei', body: 'Only on Safari?', createdAt: '', index: 2,
    anchor: { kind: 'timecode', ms: 28_000 }, needsReply: false, resolved: false },
  { id: '3', author: 'Sam Ortiz', body: 'What build is this?', createdAt: '', index: 3,
    anchor: { kind: 'timecode', ms: 39_000 }, needsReply: true, resolved: false },
];

const noop = () => {};

describe('video share (C1)', () => {
  it('seeks when a timeline marker is clicked', async () => {
    const onSeek = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={onSeek} onPost={noop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Comment at 0:28' }));
    expect(onSeek).toHaveBeenCalledWith(28_000);
  });

  it('seeks when the comment itself is clicked', async () => {
    const onSeek = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={onSeek} onPost={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /Comment 1 from Dan Keller/ }));
    expect(onSeek).toHaveBeenCalledWith(11_000);
  });

  it('marks the one comment awaiting a reply in coral and in words', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={noop} onPost={noop} />);
    expect(screen.getByLabelText(/Comment 3 from Sam Ortiz, needs a reply/)).toBeInTheDocument();
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('uses a passive frame — nothing on a share page is resizable', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={noop} onPost={noop} />);
    expect(screen.queryAllByTestId('handle')).toHaveLength(0);
  });

  it('carries no promotion', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={noop} onPost={noop} />);
    expect(screen.queryByText(/What is SnapRec/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Add to Chrome/ })).toBeNull();
  });

  it('lets an anonymous viewer comment', async () => {
    const onPost = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={noop} onPost={onPost} />);
    await userEvent.type(screen.getByRole('textbox', { name: /comment/i }), 'Same here');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ content: 'Same here' }));
  });

  it('attaches the current playhead to a new comment', async () => {
    const onPost = vi.fn();
    render(<VideoShare capture={capture} comments={comments} currentMs={28_400}
      onSeek={noop} onPost={onPost} />);
    await userEvent.type(screen.getByRole('textbox', { name: /comment/i }), 'Here');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ timecodeMs: 28_400 }));
  });

  it('says where the comment will land', () => {
    render(<VideoShare capture={capture} comments={comments} currentMs={28_000}
      onSeek={noop} onPost={noop} />);
    expect(screen.getByText(/Commenting at 0:28/)).toBeInTheDocument();
  });

  it('hides download when the owner disallowed it', () => {
    render(<VideoShare capture={{ ...capture, allowDownload: false }} comments={[]}
      onSeek={noop} onPost={noop} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});

/** Nothing stored a duration until recently, so `recording.duration ?? 0`
 * reached the header as zero and it read "0:00" beside the owner — a confident
 * claim that the clip is empty, on a page that was visibly playing it. */
describe('a capture whose length is not known', () => {
  it('names the owner without asserting a length', () => {
    render(<VideoShare capture={{ ...capture, durationMs: 0 }} comments={[]}
      currentMs={0} onSeek={noop} onPost={noop} onDownload={noop} />);
    // Scoped to the header line: the comment composer legitimately shows the
    // playhead as 0:00, which is a different claim entirely.
    expect(screen.getByText('Priya Raman').textContent).toBe('Priya Raman');
  });

  it('still shows the length when it is known', () => {
    render(<VideoShare capture={capture} comments={[]}
      currentMs={0} onSeek={noop} onPost={noop} onDownload={noop} />);
    expect(screen.getByText('Priya Raman · 0:47')).toBeInTheDocument();
  });
});
