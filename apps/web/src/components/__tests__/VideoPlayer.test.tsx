import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../VideoPlayer';

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
});
afterEach(() => vi.restoreAllMocks());

/** jsdom never loads media, so duration is declared and the event fired by hand. */
function withDuration(seconds: number) {
  const video = document.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', { value: seconds, configurable: true });
  fireEvent.loadedMetadata(video);
  return video;
}

const markers = [
  { id: 'a', ms: 41_000, needsReply: true },
  { id: 'b', ms: 138_000, needsReply: false },
];

describe('comment markers on the scrubber', () => {
  it('places a marker at its share of the running time', () => {
    render(<VideoPlayer src="x.webm" markers={markers} />);
    withDuration(182);
    const marker = screen.getByRole('button', { name: 'Comment at 0:41' });
    // 41 of 182 seconds
    expect(marker.style.left).toBe(`${(41 / 182) * 100}%`);
  });

  it('seeks to the comment when its marker is clicked', async () => {
    const onMarkerClick = vi.fn();
    const user = userEvent.setup();
    render(<VideoPlayer src="x.webm" markers={markers} onMarkerClick={onMarkerClick} />);
    withDuration(182);
    await user.click(screen.getByRole('button', { name: 'Comment at 2:18' }));
    expect(onMarkerClick).toHaveBeenCalledWith(138_000);
  });

  it('draws no markers before the duration is known, rather than stacking them at zero', () => {
    render(<VideoPlayer src="x.webm" markers={markers} />);
    expect(screen.queryByRole('button', { name: /Comment at/ })).toBeNull();
  });

  it('renders nothing extra when there are no comments', () => {
    render(<VideoPlayer src="x.webm" />);
    withDuration(182);
    expect(screen.queryByRole('button', { name: /Comment at/ })).toBeNull();
  });
});

describe('captions', () => {
  /** Transcription was cut from the product (plan O8), and captions depend on
   * it entirely. The control is gone rather than permanently inert. */
  it('offers no captions control', () => {
    render(<VideoPlayer src="x.webm" />);
    expect(screen.queryByRole('button', { name: /captions/i })).toBeNull();
  });
});

describe('keyboard control', () => {
  const setup = () => {
    const utils = render(<VideoPlayer src="x.webm" />);
    const video = withDuration(182);
    const stage = screen.getByTestId('player-stage');
    stage.focus();
    return { ...utils, video, stage };
  };

  it('plays and pauses on space', async () => {
    const { stage } = setup();
    fireEvent.keyDown(stage, { key: ' ' });
    expect(play).toHaveBeenCalled();
  });

  it('scrubs with the arrow keys', () => {
    const { stage, video } = setup();
    video.currentTime = 30;
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(35);
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(video.currentTime).toBe(30);
  });

  it('steps a frame at a time with , and .', () => {
    const { stage, video } = setup();
    video.currentTime = 10;
    fireEvent.keyDown(stage, { key: '.' });
    expect(video.currentTime).toBeCloseTo(10 + 1 / 30, 3);
    fireEvent.keyDown(stage, { key: ',' });
    expect(video.currentTime).toBeCloseTo(10, 3);
  });

  it('mutes with m', () => {
    const { stage, video } = setup();
    fireEvent.keyDown(stage, { key: 'm' });
    expect(video.muted).toBe(true);
  });

  it('never scrubs past either end', () => {
    const { stage, video } = setup();
    video.currentTime = 0;
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(video.currentTime).toBe(0);
    video.currentTime = 182;
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(182);
  });
});

describe('the controls are reachable without sight', () => {
  it('names every transport control', () => {
    render(<VideoPlayer src="x.webm" />);
    for (const name of ['Play', 'Back 10 seconds', 'Forward 10 seconds',
                        'Playback speed', 'Mute', 'Full screen']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});

describe('playing across removed footage (E3.4)', () => {
  const skipRanges = [{ startSec: 20, endSec: 30 }];

  const setup = (props = {}) => {
    render(<VideoPlayer src="x.webm" skipRanges={skipRanges} {...props} />);
    return withDuration(182);
  };

  it('jumps to the far side when playback reaches a cut', () => {
    const video = setup();
    video.currentTime = 22;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(30);
  });

  it('leaves footage outside any cut alone', () => {
    const video = setup();
    video.currentTime = 15;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(15);
  });

  /** Scrubbing into removed footage has to land the same way, or the preview
   * disagrees with the export depending on how you got there. */
  it('lands past the cut when scrubbed into one', () => {
    const video = setup();
    video.currentTime = 29.9;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(30);
  });

  it('treats the end of a cut as playable', () => {
    const video = setup();
    video.currentTime = 30;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(30);
  });

  /** Seeking past the end and sitting there is the failure this avoids. */
  it('stops rather than seeking past the end when a cut runs to the finish', () => {
    const video = setup({ skipRanges: [{ startSec: 170, endSec: 182 }] });
    video.currentTime = 175;
    fireEvent.timeUpdate(video);
    expect(pause).toHaveBeenCalled();
    expect(video.currentTime).toBe(182);
  });

  it('stops at the trim end, not the clip end, when trimmed', () => {
    const video = setup({
      skipRanges: [{ startSec: 90, endSec: 120 }],
      playbackRange: { start: 10, end: 120 },
    });
    video.currentTime = 100;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(120);
  });

  it('behaves exactly as before when nothing is cut', () => {
    const video = setup({ skipRanges: [] });
    video.currentTime = 22;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(22);
  });
});

describe('clicking the picture', () => {
  /** The controls overlay covers the whole player. Leaving it interactive meant
   * a click in the middle hit the gradient and playback never toggled. */
  it('does not let the controls overlay swallow clicks', () => {
    render(<VideoPlayer src="x.webm" />);
    const stage = screen.getByTestId('player-stage');
    const overlay = stage.querySelector('.bg-gradient-to-t') as HTMLElement;
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('keeps the scrubber and transport clickable', () => {
    render(<VideoPlayer src="x.webm" />);
    const scrubber = screen.getByTestId('player-stage').querySelector('.group\\/progress') as HTMLElement;
    expect(scrubber.className).toContain('pointer-events-auto');
    expect(screen.getByRole('button', { name: 'Play' }).closest('.pointer-events-auto')).not.toBeNull();
  });

  it('toggles playback when the video itself is clicked', () => {
    render(<VideoPlayer src="x.webm" />);
    withDuration(60);
    fireEvent.click(document.querySelector('video') as HTMLVideoElement);
    expect(play).toHaveBeenCalled();
  });
});

/** A webm from MediaRecorder carries no duration in its header, so the element
 * reports Infinity and the only way to learn the length from the file is to seek
 * past the end and make the browser scan — which downloads the whole thing. On a
 * presigned R2 URL that measured ten seconds of `--:--` for a forty-second clip.
 *
 * The length is already measured at upload and stored, so the scan buys a number
 * we have. These tests pin both halves: use the stored value, and keep the scan
 * for recordings captured before anything measured them. */
describe('a recording whose file does not know how long it is', () => {
  function withInfiniteDuration() {
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
    fireEvent.loadedMetadata(video);
    return video;
  }

  it('shows the stored length instead of waiting for the file', () => {
    render(<VideoPlayer src="x.webm" knownDurationSec={182} />);
    withInfiniteDuration();
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:00 / 3:02');
  });

  it('does not download the file to find an end it was already told', () => {
    render(<VideoPlayer src="x.webm" knownDurationSec={182} />);
    const video = withInfiniteDuration();
    expect(video.currentTime).toBe(0);
  });

  it('still scans when nobody measured the recording', () => {
    render(<VideoPlayer src="x.webm" />);
    const video = withInfiniteDuration();
    expect(video.currentTime).toBeGreaterThan(1e9);
  });

  /** The file is the authority once it speaks: a stored value can be stale after
   * a trim, so a real duration from the element must win. */
  it('prefers the length the file reports once it has one', () => {
    render(<VideoPlayer src="x.webm" knownDurationSec={182} />);
    withDuration(90);
    expect(screen.getByTestId('player-time')).toHaveTextContent('0:00 / 1:30');
  });
});
