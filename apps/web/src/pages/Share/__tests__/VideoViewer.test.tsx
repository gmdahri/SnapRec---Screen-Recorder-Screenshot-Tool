import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoViewer, type ViewerCapture } from '../VideoViewer';
import type { ShareComment } from '../anchors';

const capture: ViewerCapture = {
  id: 'c1',
  title: 'Follow-up for Brightline demo',
  owner: 'Maya Ortiz',
  createdAt: '2026-08-09T10:00:00Z',
  durationMs: 182_000,
  dimensions: '1920×1080',
  description: 'Walkthrough of the two changes Brightline asked for.',
  status: 'shared',
  views: 38,
  allowDownload: true,
  canEdit: true,
};

const comments: ShareComment[] = [
  { id: '1', author: 'Dana Kwon', body: 'The split rule is right', createdAt: '2026-08-09T12:00:00Z',
    index: 1, anchor: { kind: 'timecode', ms: 41_000 }, needsReply: true, resolved: false },
  { id: '2', author: 'Maya Ortiz', body: 'Rounds to the primary payee.', createdAt: '2026-08-09T12:05:00Z',
    index: 2, anchor: { kind: 'timecode', ms: 41_000 }, needsReply: false, resolved: true },
];

const noop = () => {};
const base = {
  capture, comments, currentMs: 0,
  onBack: noop, onSeek: noop, onPost: noop, onCopyLink: noop,
};

describe('viewer top bar', () => {
  it('names the capture and its sharing state', () => {
    render(<VideoViewer {...base} />);
    const bar = screen.getByTestId('viewer-topbar');
    expect(within(bar).getByText(capture.title)).toBeInTheDocument();
    expect(within(bar).getByText('shared')).toBeInTheDocument();
  });

  it('offers back, download, edit and copy link', async () => {
    const onBack = vi.fn(); const onDownload = vi.fn();
    const onEdit = vi.fn(); const onCopyLink = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onBack={onBack} onDownload={onDownload}
      onEdit={onEdit} onCopyLink={onCopyLink} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onCopyLink).toHaveBeenCalledOnce();
  });

  /** A viewer who cannot edit must not be shown a control that will 403. */
  it('hides Edit when the viewer does not own the capture', () => {
    render(<VideoViewer {...base} capture={{ ...capture, canEdit: false }} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('hides Download when downloading is not allowed', () => {
    render(<VideoViewer {...base} capture={{ ...capture, allowDownload: false }} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});

describe('metadata block', () => {
  it('states owner, date, duration and dimensions', () => {
    render(<VideoViewer {...base} />);
    const meta = screen.getByTestId('viewer-meta');
    expect(meta).toHaveTextContent('Maya Ortiz');
    expect(meta).toHaveTextContent('3:02');
    expect(meta).toHaveTextContent('1920×1080');
  });

  /** The 0:00 bug, guarded at the new surface too. */
  it('omits a duration it does not know instead of claiming 0:00', () => {
    render(<VideoViewer {...base} capture={{ ...capture, durationMs: 0 }} />);
    expect(screen.getByTestId('viewer-meta')).not.toHaveTextContent('0:00');
  });

  it('omits dimensions that were never captured', () => {
    render(<VideoViewer {...base} capture={{ ...capture, dimensions: undefined }} />);
    expect(screen.getByTestId('viewer-meta')).not.toHaveTextContent('×');
  });

  it('drops the description block when there is no description', () => {
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }} />);
    expect(screen.queryByTestId('viewer-description')).toBeNull();
  });
});

describe('stat tiles', () => {
  it('counts views and comments', () => {
    render(<VideoViewer {...base} />);
    const tiles = screen.getByTestId('viewer-stats');
    expect(within(tiles).getByText('38')).toBeInTheDocument();
    expect(within(tiles).getByText('2')).toBeInTheDocument();
  });

  /** "0%" reads as "nobody watched"; the truth is "we did not measure". */
  it('shows no watched tile until a signed-in viewer has watched', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getByTestId('viewer-stats')).not.toHaveTextContent(/watched/i);
  });

  it('shows the coverage once there is some', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 87 }} />);
    const tiles = screen.getByTestId('viewer-stats');
    expect(tiles).toHaveTextContent('WATCHED');
    expect(within(tiles).getByText('87%')).toBeInTheDocument();
  });

  it('shows a genuine zero, which is different from unmeasured', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 0 }} />);
    expect(within(screen.getByTestId('viewer-stats')).getByText('0%')).toBeInTheDocument();
  });

  /** Guests are never individually tracked, so on a widely shared link this
   * figure describes a minority of the audience. It must not imply otherwise. */
  it('says the figure covers signed-in viewers only', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 87 }} />);
    expect(screen.getByTitle(/signed-in viewers only/i)).toBeInTheDocument();
  });
});

describe('the side rail', () => {
  it('opens on comments and lists them with their timecodes', () => {
    render(<VideoViewer {...base} />);
    const rail = screen.getByTestId('viewer-rail');
    expect(within(rail).getByText('Dana Kwon')).toBeInTheDocument();
    expect(within(rail).getAllByText('0:41')).toHaveLength(2);
  });

  it('seeks when a comment is clicked', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onSeek={onSeek} />);
    await user.click(screen.getByRole('button', { name: /Dana Kwon/ }));
    expect(onSeek).toHaveBeenCalledWith(41_000);
  });

  it('marks a resolved comment as resolved', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('says so plainly when there are no comments', () => {
    render(<VideoViewer {...base} comments={[]} />);
    expect(screen.getByTestId('viewer-rail')).toHaveTextContent(/No comments yet/i);
  });

  /** Transcription was cut from the product (plan O8). The tab is gone rather
   * than permanently empty — an inert tab is a promise the product will not
   * keep, and the tables behind it are recorded in docs/unused-schema.md. */
  it('offers no transcript tab at all', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByRole('tab', { name: /transcript/i })).toBeNull();
    expect(screen.getByTestId('viewer-rail')).not.toHaveTextContent(/transcript/i);
  });

  it('leaves exactly the two tabs that have something behind them', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getAllByRole('tab').map(t => t.textContent))
      .toEqual(['Comments 2', 'Details']);
  });

  it('shows details of the capture on the details tab', async () => {
    const user = userEvent.setup();
    render(<VideoViewer {...base} />);
    await user.click(screen.getByRole('tab', { name: /Details/ }));
    const rail = screen.getByTestId('viewer-rail');
    expect(rail).toHaveTextContent('1920×1080');
    expect(rail).toHaveTextContent('Maya Ortiz');
  });

  it('tells the composer which moment a comment will pin to', () => {
    render(<VideoViewer {...base} currentMs={72_000} />);
    expect(screen.getByTestId('viewer-rail')).toHaveTextContent('1:12');
  });
});

describe('the composer is actually wired to the playhead', () => {
  /** Passing the wrong prop name still renders, and every other test still
   * passes — the comment just posts with no anchor. Only tsc caught it the
   * first time, so the behaviour is pinned here too. */
  it('posts a comment anchored to the current moment', async () => {
    const onPost = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} currentMs={72_000} onPost={onPost} />);

    await user.type(screen.getByLabelText('Write a comment'), 'Looks right');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ timecodeMs: 72_000 }));
  });
});

describe('settling a comment from the rail', () => {
  const canResolve = () => true;

  it('offers resolve on an open comment and reopen on a settled one', () => {
    render(<VideoViewer {...base} onResolve={() => {}} canResolve={canResolve} />);
    expect(screen.getByRole('button', { name: 'Resolve comment from Dana Kwon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen comment from Maya Ortiz' })).toBeInTheDocument();
  });

  it('reports the change', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onResolve={onResolve} canResolve={canResolve} />);
    await user.click(screen.getByRole('button', { name: 'Resolve comment from Dana Kwon' }));
    expect(onResolve).toHaveBeenCalledWith('1', true);
  });

  /** Guests and other viewers get no control at all, rather than one the
   * server will reject. */
  it('offers nothing to someone who may not settle', () => {
    render(<VideoViewer {...base} onResolve={() => {}} canResolve={() => false} />);
    expect(screen.queryByRole('button', { name: /Resolve comment/ })).toBeNull();
  });

  it('offers nothing when no handler was supplied', () => {
    render(<VideoViewer {...base} canResolve={canResolve} />);
    expect(screen.queryByRole('button', { name: /Resolve comment/ })).toBeNull();
  });

  it('puts open questions before settled ones', () => {
    render(<VideoViewer {...base} />);
    const authors = screen.getAllByRole('button', { name: /^Comment from/ })
      .map(b => b.getAttribute('aria-label'));
    expect(authors[0]).toContain('Dana Kwon');
  });

  it('can hide the settled ones', async () => {
    const user = userEvent.setup();
    render(<VideoViewer {...base} />);
    expect(screen.getByText('Maya Ortiz')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /show resolved/i }));
    expect(screen.queryByText('Maya Ortiz')).toBeNull();
    expect(screen.getByText('Dana Kwon')).toBeInTheDocument();
  });

  it('does not offer the filter when nothing is settled', () => {
    render(<VideoViewer {...base} comments={[base.comments[0]]} />);
    expect(screen.queryByRole('checkbox', { name: /show resolved/i })).toBeNull();
  });
});

describe('a comment stranded by a publish (E6)', () => {
  const past = { ...comments[0], id: '9', anchor: { kind: 'timecode' as const, ms: 400_000 } };

  /** Publishing a shorter cut can leave a comment pointing past the end. It is
   * not deleted — what someone wrote is still real. */
  it('says the footage was removed rather than deleting the comment', () => {
    render(<VideoViewer {...base} comments={[past]} />);
    expect(screen.getByText('Dana Kwon')).toBeInTheDocument();
    expect(screen.getByTestId('stale-anchor')).toBeInTheDocument();
  });

  it('leaves comments inside the video unmarked', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByTestId('stale-anchor')).toBeNull();
  });

  /** Without a known length every comment would be marked stale. */
  it('claims nothing when the length is unknown', () => {
    render(<VideoViewer {...base} comments={[past]}
      capture={{ ...capture, durationMs: 0 }} />);
    expect(screen.queryByTestId('stale-anchor')).toBeNull();
  });
});

describe('editing the description', () => {
  it('offers to add one when there is none and the viewer may edit', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }}
      onDescriptionChange={onDescriptionChange} />);

    await user.click(screen.getByRole('button', { name: 'Add description' }));
    await user.type(screen.getByLabelText('Description'), 'What this covers');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDescriptionChange).toHaveBeenCalledWith('What this covers');
  });

  it('edits an existing one in place', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    expect(screen.getByLabelText('Description')).toHaveValue(capture.description);
  });

  /** An empty string is how a description is removed. */
  it('allows clearing it', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDescriptionChange).toHaveBeenCalledWith('');
  });

  it('abandons the edit on cancel', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDescriptionChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('viewer-description')).toBeInTheDocument();
  });

  /** A viewer who cannot edit must not be shown the affordance. */
  it('offers nothing to someone who may not edit', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByRole('button', { name: /description/i })).toBeNull();
  });

  it('shows nothing at all when there is no description and no permission', () => {
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }} />);
    expect(screen.queryByTestId('viewer-description')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add description' })).toBeNull();
  });
});

describe('the auto-generated filmstrip', () => {
  const frames = [
    { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
    { startSec: 41, sampleSec: 41.5, dataUrl: 'data:image/jpeg;base64,BBB' },
    { startSec: 138, sampleSec: 138.5, dataUrl: null },
  ];

  it('shows a frame per section with its timecode', () => {
    render(<VideoViewer {...base} frames={frames} />);
    const strip = screen.getByTestId('viewer-frames');
    expect(within(strip).getAllByRole('button')).toHaveLength(3);
    expect(within(strip).getByText('2:18')).toBeInTheDocument();
  });

  /** The whole point: jump to any part of the video. */
  it('seeks to that point when a frame is clicked', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} frames={frames} onSeek={onSeek} />);
    await user.click(screen.getByRole('button', { name: 'Jump to 0:41' }));
    expect(onSeek).toHaveBeenCalledWith(41_000);
  });

  it('marks the section the playhead is inside', () => {
    render(<VideoViewer {...base} frames={frames} currentMs={60_000} />);
    expect(screen.getByRole('button', { name: 'Jump to 0:41' }))
      .toHaveAttribute('aria-current', 'true');
  });

  it('stays on the first section before the second begins', () => {
    render(<VideoViewer {...base} frames={frames} currentMs={10_000} />);
    expect(screen.getByRole('button', { name: 'Jump to 0:00' }))
      .toHaveAttribute('aria-current', 'true');
  });

  /** Timecodes navigate on their own, so a frame without a picture is still
   * useful rather than a hole in the strip. */
  it('still offers a frame whose picture could not be drawn', () => {
    render(<VideoViewer {...base} frames={frames} />);
    expect(screen.getByRole('button', { name: 'Jump to 2:18' })).toBeInTheDocument();
  });

  it('says when it is still working', () => {
    render(<VideoViewer {...base} frames={frames} framesGenerating />);
    expect(screen.getByTestId('viewer-frames')).toHaveTextContent(/generating/);
  });

  /** A tainted canvas makes pictures impossible, not slow — say so instead of
   * showing a spinner that never resolves. */
  it('says when previews are impossible for this file', () => {
    render(<VideoViewer {...base} frames={frames} framesBlocked />);
    expect(screen.getByTestId('viewer-frames')).toHaveTextContent(/previews unavailable/);
  });

  it('shows no strip at all before any frames are placed', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByTestId('viewer-frames')).toBeNull();
  });
});
