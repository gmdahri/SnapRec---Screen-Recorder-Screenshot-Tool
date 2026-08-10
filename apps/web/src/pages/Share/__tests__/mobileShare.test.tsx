import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileVideoShare } from '../MobileVideoShare';
import { MobileImageShare } from '../MobileImageShare';
import type { ShareComment } from '../anchors';

const video = { id: 'c1', title: 'Bug repro', owner: 'Priya', durationMs: 47_000, allowDownload: true };
const image = { id: 'c2', title: 'Plan selection', owner: 'Priya', width: 2880, height: 1620, allowDownload: true };

const vComments: ShareComment[] = [
  { id: '1', author: 'Sam', body: 'Which build?', createdAt: '', index: 1,
    anchor: { kind: 'timecode', ms: 39_000 }, needsReply: true, resolved: false },
];
const iComments: ShareComment[] = [
  { id: '1', author: 'Sam', body: 'Move this', createdAt: '', index: 1,
    anchor: { kind: 'point', x: 0.3, y: 0.4 }, needsReply: false, resolved: false },
];

const noop = () => {};

describe('mobile video share (C3)', () => {
  it('shows watched progress, unavailable transcript, and chapter jump targets', () => {
    const frames = [
      { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
      { startSec: 39, sampleSec: 39.5, dataUrl: null },
    ];
    render(<MobileVideoShare capture={{ ...video, watchedPercent: 87 }} comments={vComments}
      frames={frames} onSeek={noop} onPost={noop} />);

    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Transcript/ }))
      .toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tab', { name: /Transcript/ })).toBeDisabled();
    expect(screen.getByTestId('mobile-chapters')).toHaveTextContent('CHAPTERS');
    expect(screen.getAllByRole('button', { name: /Jump to/ })).toHaveLength(2);
  });

  it('omits watched progress when it is null or absent', () => {
    const { rerender } = render(<MobileVideoShare
      capture={{ ...video, watchedPercent: null }} comments={vComments} onSeek={noop} onPost={noop}
    />);
    expect(screen.queryByText('WATCHED')).toBeNull();
    expect(screen.queryByText('87%')).toBeNull();

    rerender(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.queryByText('WATCHED')).toBeNull();
    expect(screen.queryByText('87%')).toBeNull();
  });

  it('seeks when a chapter is selected', async () => {
    const onSeek = vi.fn();
    const frames = [
      { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
      { startSec: 39, sampleSec: 39.5, dataUrl: null },
    ];
    const user = userEvent.setup();
    render(<MobileVideoShare capture={video} comments={vComments} frames={frames}
      onSeek={onSeek} onPost={noop} />);

    await user.click(screen.getByRole('button', { name: 'Jump to 0:39' }));
    expect(onSeek).toHaveBeenCalledWith(39_000);
  });

  it('pins the player so seeking never scrolls it out of view', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByTestId('sticky-player').dataset.sticky).toBe('true');
  });

  it('keeps the timecode column but drops the time-axis layout', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByText('0:39')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-columns')).toBeNull();
  });

  it('names what needs attention on the sheet', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByText(/1 needs a reply/)).toBeInTheDocument();
  });

  it('pads every control to 44px, including the player icons', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    for (const b of screen.getAllByRole('button')) {
      expect(Number(b.dataset.minTarget)).toBeGreaterThanOrEqual(44);
    }
  });

  it('moves download into an overflow sheet, away from playback', async () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});

describe('mobile image share (C4)', () => {
  it('draws no leaders at all', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    expect(screen.queryAllByTestId('leader')).toHaveLength(0);
  });

  it('pairs comment and pin by selection instead, and by number', async () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    await userEvent.click(screen.getByTestId('note-1'));
    expect(screen.getByRole('button', { name: 'Pin 1' })).toHaveAttribute('data-halo', 'true');
    expect(screen.getByTestId('note-1').dataset.selected).toBe('true');
  });

  it('keeps pins at 22px with a 44px tap area', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    const pin = screen.getByRole('button', { name: 'Pin 1' });
    expect(pin.dataset.pinSize).toBe('22');
    expect(Number(pin.dataset.minTarget)).toBe(44);
  });
});
