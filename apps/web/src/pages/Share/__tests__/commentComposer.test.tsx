import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentComposer } from '../CommentComposer';
import { ImageShare, type ImageCapture } from '../ImageShare';

/** Commenting needs an account, so the composer asks for words and nothing
 * else, and a refused post has to leave the draft alone. */

describe('the comment composer', () => {
  it('asks for the comment and nothing else', () => {
    render(<CommentComposer onPost={() => {}} />);
    expect(screen.getByLabelText('Write a comment')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument();
  });

  it('sends the words and the anchor, with no author to invent', async () => {
    const onPost = vi.fn();
    render(<CommentComposer onPost={onPost} timecodeMs={41_000} />);
    await userEvent.type(screen.getByLabelText('Write a comment'), 'Rounding looks off');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(onPost).toHaveBeenCalledWith({
      content: 'Rounding looks off', timecodeMs: 41_000, anchorX: undefined, anchorY: undefined,
    });
    expect(Object.keys(onPost.mock.calls[0][0])).not.toContain('authorName');
  });

  it('clears once the comment has been taken', async () => {
    render(<CommentComposer onPost={() => {}} />);
    const field = screen.getByLabelText('Write a comment');
    await userEvent.type(field, 'Taken');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(field).toHaveValue('');
  });

  it('keeps the draft when the post is refused, so signing in does not cost it', async () => {
    render(<CommentComposer onPost={() => false} />);
    const field = screen.getByLabelText('Write a comment');
    await userEvent.type(field, 'Written before signing in');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(field).toHaveValue('Written before signing in');
  });

  it('will not post an empty comment', async () => {
    const onPost = vi.fn();
    render(<CommentComposer onPost={onPost} />);
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Write a comment'), '   ');
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
    expect(onPost).not.toHaveBeenCalled();
  });
});

describe('a refused comment on an image', () => {
  const capture: ImageCapture = {
    id: 'i1', title: 'Pricing table markup', owner: 'Maya Ortiz',
    width: 1440, height: 900, allowDownload: true,
  };

  const place = async () => {
    // jsdom reports a zero-size box, so the pin needs a measurable canvas.
    const canvas = screen.getByTestId('image-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500,
      toJSON: () => ({}),
    } as DOMRect);
    await userEvent.click(canvas);
  };

  it('keeps the pin as well as the words', async () => {
    render(<ImageShare capture={capture} comments={[]} marginPx={360} onPost={() => false} />);
    await place();
    expect(screen.getByTestId('pending-pin')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Write a comment'), 'Column 3');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(screen.getByTestId('pending-pin')).toBeInTheDocument();
    expect(screen.getByLabelText('Write a comment')).toHaveValue('Column 3');
  });

  it('drops the pin once the comment is taken', async () => {
    render(<ImageShare capture={capture} comments={[]} marginPx={360} onPost={() => {}} />);
    await place();
    await userEvent.type(screen.getByLabelText('Write a comment'), 'Column 3');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(screen.queryByTestId('pending-pin')).not.toBeInTheDocument();
  });
});
