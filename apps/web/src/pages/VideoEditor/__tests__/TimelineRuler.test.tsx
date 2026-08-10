import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TimelineRuler } from '../TimelineRuler';

/** jsdom gives every element a zero width, so the ruler would never draw. */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1300);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 1300, bottom: 22, width: 1300, height: 22, x: 0, y: 0,
    toJSON: () => {},
  } as DOMRect);
});

const noop = () => {};

describe('the ruler', () => {
  it('draws ticks once the clip has a length', () => {
    render(<TimelineRuler durationSec={182} playheadSec={0} onSeek={noop} />);
    expect(screen.getAllByTestId('ruler-tick').length).toBeGreaterThan(2);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  /** A scale with no units is worse than no scale. */
  it('draws nothing at all while the length is unknown', () => {
    render(<TimelineRuler durationSec={0} playheadSec={0} onSeek={noop} />);
    expect(screen.queryAllByTestId('ruler-tick')).toHaveLength(0);
    expect(screen.queryByTestId('ruler-playhead')).toBeNull();
  });

  it('puts the playhead at its share of the clip', () => {
    render(<TimelineRuler durationSec={180} playheadSec={90} onSeek={noop} />);
    expect(screen.getByTestId('ruler-playhead').style.left).toBe('50%');
  });

  it('keeps the playhead inside the ruler even if the clock overruns', () => {
    render(<TimelineRuler durationSec={180} playheadSec={999} onSeek={noop} />);
    expect(screen.getByTestId('ruler-playhead').style.left).toBe('100%');
  });
});

describe('seeking on the ruler', () => {
  it('seeks where it is clicked', () => {
    const onSeek = vi.fn();
    render(<TimelineRuler durationSec={182} playheadSec={0} onSeek={onSeek} />);
    fireEvent.mouseDown(screen.getByTestId('timeline-ruler'), { clientX: 650 });
    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(91, 1));
  });

  /** The pointer routinely leaves a 22px-tall strip mid-drag; the drag has to
   * survive that or the timeline appears to drop it. */
  it('keeps seeking when the pointer leaves the strip mid-drag', () => {
    const onSeek = vi.fn();
    render(<TimelineRuler durationSec={182} playheadSec={0} onSeek={onSeek} />);
    fireEvent.mouseDown(screen.getByTestId('timeline-ruler'), { clientX: 100 });
    onSeek.mockClear();
    fireEvent.mouseMove(window, { clientX: 900 });
    expect(onSeek).toHaveBeenCalled();
  });

  it('stops seeking once the button is released', () => {
    const onSeek = vi.fn();
    render(<TimelineRuler durationSec={182} playheadSec={0} onSeek={onSeek} />);
    fireEvent.mouseDown(screen.getByTestId('timeline-ruler'), { clientX: 100 });
    fireEvent.mouseUp(window);
    onSeek.mockClear();
    fireEvent.mouseMove(window, { clientX: 900 });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('is reachable from the keyboard', () => {
    const onSeek = vi.fn();
    render(<TimelineRuler durationSec={182} playheadSec={40} onSeek={onSeek} />);
    const ruler = screen.getByTestId('timeline-ruler');
    fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(41);
    fireEvent.keyDown(ruler, { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenCalledWith(39);
  });

  it('announces its position to assistive tech', () => {
    render(<TimelineRuler durationSec={182} playheadSec={72} onSeek={noop} />);
    const ruler = screen.getByRole('slider', { name: 'Timeline position' });
    expect(ruler).toHaveAttribute('aria-valuetext', '1:12');
    expect(ruler).toHaveAttribute('aria-valuemax', '182');
  });
});
