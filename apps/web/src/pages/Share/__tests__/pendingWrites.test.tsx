import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoViewer, type ViewerCapture } from '../VideoViewer';
import { ImageShare, type ImageCapture } from '../ImageShare';
import { MobileImageShare } from '../MobileImageShare';
import { MobileVideoShare } from '../MobileVideoShare';
import type { ShareComment } from '../anchors';

/** Writing is not instant, and the surfaces used to say nothing about it.
 *
 * A comment left the composer and existed nowhere until the refetch landed; a
 * description was replaced by its own previous copy for the length of the round
 * trip. These cover both windows. */

const capture: ViewerCapture = {
  id: 'c1',
  title: 'Follow-up for Brightline demo',
  owner: 'Maya Ortiz',
  createdAt: '2026-08-09T10:00:00Z',
  durationMs: 182_000,
  description: 'Walkthrough of the two changes Brightline asked for.',
  status: 'shared',
  views: 38,
  allowDownload: true,
  canEdit: true,
};

const comments: ShareComment[] = [
  { id: '1', author: 'Dana Kwon', body: 'The split rule is right', createdAt: '2026-08-09T12:00:00Z',
    index: 1, anchor: { kind: 'timecode', ms: 41_000 }, needsReply: true, resolved: false },
];

const noop = () => {};
const base = {
  capture, comments, currentMs: 0,
  onBack: noop, onSeek: noop, onPost: noop, onCopyLink: noop,
};

const imageCapture: ImageCapture = {
  id: 'i1', title: 'Pricing table markup', owner: 'Maya Ortiz',
  width: 1440, height: 900, allowDownload: true,
};

const pointComments: ShareComment[] = [
  { id: 'p1', author: 'Dana Kwon', body: 'Column 3 is misaligned', createdAt: '2026-08-09T12:00:00Z',
    index: 1, anchor: { kind: 'point', x: 0.4, y: 0.5 }, needsReply: false, resolved: false },
];

describe('a comment in flight', () => {
  it('holds a skeleton row in the video thread', () => {
    render(<VideoViewer {...base} postingComment />);
    expect(screen.getByTestId('pending-comment')).toBeInTheDocument();
  });

  it('is absent when nothing is being posted', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByTestId('pending-comment')).not.toBeInTheDocument();
  });

  it('replaces "no comments yet" rather than contradicting it', () => {
    render(<VideoViewer {...base} comments={[]} postingComment />);
    expect(screen.getByTestId('pending-comment')).toBeInTheDocument();
    expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument();
  });

  it('still says there are none once the post has landed', () => {
    render(<VideoViewer {...base} comments={[]} />);
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  it('sits above the existing thread, in reach of the composer', () => {
    render(<VideoViewer {...base} postingComment />);
    const rail = screen.getByTestId('viewer-rail');
    const order = within(rail).getByTestId('pending-comment')
      .compareDocumentPosition(within(rail).getByText('The split rule is right'));
    // FOLLOWING === 4: the real comment comes after the skeleton.
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says what it is doing rather than resting on the blocks', () => {
    render(<VideoViewer {...base} postingComment />);
    expect(screen.getByRole('status')).toHaveTextContent('Posting your comment');
    expect(within(screen.getByTestId('pending-comment')).getByText('posting…')).toBeInTheDocument();
  });

  it('uses the indeterminate sweep, never a percentage', () => {
    render(<VideoViewer {...base} postingComment />);
    const pending = screen.getByTestId('pending-comment');
    expect(within(pending).getByTestId('sweep')).toBeInTheDocument();
    // No invented percentage. queryByText skips <style>, where the keyframes
    // legitimately carry one.
    expect(within(pending).queryByText(/\d+\s*%/)).not.toBeInTheDocument();
  });

  it('does not inflate the comment count with a row that does not exist yet', () => {
    render(<VideoViewer {...base} postingComment />);
    expect(screen.getByRole('tab', { name: 'Comments 1' })).toBeInTheDocument();
  });

  it('reaches the image margin, the phone thread and the phone image list', () => {
    const { unmount } = render(
      <ImageShare capture={imageCapture} comments={pointComments} marginPx={360}
        onPost={noop} postingComment />,
    );
    expect(screen.getByTestId('pending-comment')).toBeInTheDocument();
    unmount();

    const phoneVideo = render(
      <MobileVideoShare capture={{ ...capture, durationMs: capture.durationMs }}
        comments={comments} onSeek={noop} onPost={noop} postingComment />,
    );
    expect(screen.getByTestId('pending-comment')).toBeInTheDocument();
    phoneVideo.unmount();

    render(
      <MobileImageShare capture={imageCapture} comments={pointComments} onPost={noop} postingComment />,
    );
    expect(screen.getByTestId('pending-comment')).toBeInTheDocument();
  });
});

describe('a description being saved', () => {
  const openEditor = async (props: Partial<Parameters<typeof VideoViewer>[0]> = {}) => {
    const onDescriptionChange = vi.fn();
    const view = render(
      <VideoViewer {...base} onDescriptionChange={onDescriptionChange}
        descriptionSaving={false} {...props} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    return { view, onDescriptionChange };
  };

  it('keeps the draft on screen instead of restoring the previous text', async () => {
    const { view, onDescriptionChange } = await openEditor();
    const field = screen.getByLabelText('Description');
    await userEvent.clear(field);
    await userEvent.type(field, 'Rewritten after the call');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDescriptionChange).toHaveBeenCalledWith('Rewritten after the call');

    // The parent's mutation is now in flight, and its `capture.description` is
    // still the old text. The editor must not close onto it.
    view.rerender(
      <VideoViewer {...base} onDescriptionChange={onDescriptionChange} descriptionSaving />,
    );
    expect(screen.getByTestId('description-editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Rewritten after the call');
    expect(screen.queryByTestId('viewer-description')).not.toBeInTheDocument();
  });

  it('shows the saving state the button has always claimed to have', async () => {
    const { view, onDescriptionChange } = await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    view.rerender(
      <VideoViewer {...base} onDescriptionChange={onDescriptionChange} descriptionSaving />,
    );

    const editor = screen.getByTestId('description-editor');
    expect(within(editor).getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(within(editor).getByTestId('sweep')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('saving your description');
  });

  it('locks the field and Cancel while the write is on its way', async () => {
    const { view, onDescriptionChange } = await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    view.rerender(
      <VideoViewer {...base} onDescriptionChange={onDescriptionChange} descriptionSaving />,
    );

    expect(screen.getByLabelText('Description')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('closes once the save has landed', async () => {
    const { view, onDescriptionChange } = await openEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    view.rerender(
      <VideoViewer {...base} onDescriptionChange={onDescriptionChange} descriptionSaving />,
    );
    view.rerender(
      <VideoViewer {...base}
        capture={{ ...capture, description: 'Rewritten after the call' }}
        onDescriptionChange={onDescriptionChange} descriptionSaving={false} />,
    );

    expect(screen.queryByTestId('description-editor')).not.toBeInTheDocument();
    expect(screen.getByTestId('viewer-description')).toHaveTextContent('Rewritten after the call');
  });

  it('closes on the click when the caller reports no saving state at all', async () => {
    const onDescriptionChange = vi.fn();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByTestId('description-editor')).not.toBeInTheDocument();
  });

  it('leaves Cancel free to abandon an edit that has not been sent', async () => {
    await openEditor();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('description-editor')).not.toBeInTheDocument();
  });
});
