import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapturePreview } from '../CapturePreview';
import type { Recording } from '../../hooks/useRecordings';

const rec = (over: Partial<Recording> = {}) => ({
  id: 'r1', title: 'T', fileUrl: 'https://r2/clip.webm', type: 'video',
  createdAt: '2026-08-01T00:00:00Z', views: 0, isReady: true,
  reactions: [], comments: [], ...over,
}) as Recording;

/** jsdom implements neither play nor pause on media elements. */
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
});

afterEach(() => vi.restoreAllMocks());

const video = () => screen.getByTestId('capture-video') as HTMLVideoElement;
/** Hover lives on the wrapper, not the video: the video is a decode source
 * parked at 1×1 with `pointer-events: none`, and the canvas over it is what the
 * pointer actually meets. */
const card = () => screen.getByTestId('capture-preview');

describe('a screenshot preview', () => {
  it('is a still image of the capture itself', () => {
    render(<CapturePreview recording={rec({ type: 'screenshot', fileUrl: 'https://r2/s.png' })} />);
    expect(screen.getByTestId('capture-image')).toHaveAttribute('src', 'https://r2/s.png');
    expect(screen.queryByTestId('capture-video')).toBeNull();
  });
});

describe('a recording preview', () => {
  it('loads only metadata and seeks to a frame, so the card shows a still', () => {
    render(<CapturePreview recording={rec()} />);
    expect(video()).toHaveAttribute('preload', 'metadata');
    expect(video().getAttribute('src')).toBe('https://r2/clip.webm#t=0.1');
  });

  it('is muted and looped — a grid of cards must never make noise', () => {
    render(<CapturePreview recording={rec()} />);
    expect(video()).toHaveProperty('muted', true);
    expect(video()).toHaveAttribute('loop');
  });

  /** Rendered behind the canvas rather than as the element's `poster`, because
   * the element is no longer the thing on screen. Nothing writes thumbnailUrl
   * today; this keeps the day it does from being a silent no-op. */
  it('shows a real thumbnail behind the canvas when one exists', () => {
    render(<CapturePreview recording={rec({ thumbnailUrl: 'https://r2/poster.jpg' })} />);
    expect(card().querySelector('img')).toHaveAttribute('src', 'https://r2/poster.jpg');
  });

  /** The picture is a canvas, not the video. The browser's video scaler reduces
   * a 3600px capture to a 280px card in one step, which aliases text into
   * unreadable speckle — see downscale.ts. */
  it('paints through a canvas rather than showing the video element', () => {
    render(<CapturePreview recording={rec()} />);
    expect(screen.getByTestId('capture-canvas')).toBeInTheDocument();
    expect(video()).toHaveStyle({ opacity: '0' });
  });

  it('plays on hover and rewinds when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<CapturePreview recording={rec()} />);
    const el = video();

    await user.hover(card());
    expect(play).toHaveBeenCalled();

    el.currentTime = 4;
    await user.unhover(card());
    expect(pause).toHaveBeenCalled();
    expect(el.currentTime).toBe(0);
  });

  it('swallows a rejected play, which happens when the pointer leaves mid-start', async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error('interrupted')));
    const user = userEvent.setup();
    render(<CapturePreview recording={rec()} />);
    await expect(user.hover(card())).resolves.not.toThrow();
  });
});

describe('when the viewer asks for less motion', () => {
  it('shows the frame but never starts playback', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      { matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    render(<CapturePreview recording={rec()} />);

    await user.hover(card());
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByTestId('capture-canvas')).toBeInTheDocument();
  });
});

describe('the duration it discovers from the file', () => {
  /** Each case renders its own card, so the previous one has to go first —
   * otherwise the testid matches every card left in the document. */
  const withDuration = (value: number) => {
    cleanup();
    const onDuration = vi.fn();
    render(<CapturePreview recording={rec()} onDuration={onDuration} />);
    Object.defineProperty(video(), 'duration', { value, configurable: true });
    video().dispatchEvent(new Event('loadedmetadata'));
    return onDuration;
  };

  it('reports the length once metadata arrives', () => {
    expect(withDuration(87.4)).toHaveBeenCalledWith(87.4);
  });

  /** MediaRecorder webm frequently ships without a duration in its header, and
   * the element then reports Infinity. Reporting that would render "Infinity:NaN"
   * on the card, so an unknown length stays unknown. */
  it('ignores an unknown length rather than rendering nonsense', () => {
    expect(withDuration(Infinity)).not.toHaveBeenCalled();
    expect(withDuration(NaN)).not.toHaveBeenCalled();
    expect(withDuration(0)).not.toHaveBeenCalled();
  });
});
