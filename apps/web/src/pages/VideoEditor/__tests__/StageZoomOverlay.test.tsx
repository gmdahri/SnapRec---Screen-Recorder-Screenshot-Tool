import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StageZoomOverlay } from '../StageZoomOverlay';
import type { ZoomKeyframe } from '../types';

const kf: ZoomKeyframe = {
  id: 'z1', timestamp: 68_000, duration: 11_000, x: 50, y: 50, scale: 2,
};

describe('the zoom overlay on the stage', () => {
  it('states the level and the window it covers', () => {
    render(<StageZoomOverlay keyframe={kf} />);
    expect(screen.getByTestId('zoom-label')).toHaveTextContent('ZOOM 2.0× · 01:08 → 01:19');
  });

  it('draws nothing when no zoom is selected', () => {
    render(<StageZoomOverlay keyframe={null} />);
    expect(screen.queryByTestId('stage-zoom-overlay')).toBeNull();
  });

  /** Handles, not registration marks: the zoom window is the one thing on the
   * stage that can actually be resized. */
  it('gives the window resize handles', () => {
    render(<StageZoomOverlay keyframe={kf} />);
    expect(screen.getAllByTestId('handle').length).toBeGreaterThan(0);
  });

  it('sizes the window by the zoom level', () => {
    render(<StageZoomOverlay keyframe={{ ...kf, scale: 2 }} />);
    const frame = screen.getByTestId('stage-zoom-overlay').querySelector('div') as HTMLElement;
    expect(frame.style.width).toBe('50%');
  });

  /** A pivot near an edge would otherwise push half the rectangle off the
   * stage, so the window is clamped rather than centred blindly. */
  it('keeps the window inside the stage when the pivot is at an edge', () => {
    render(<StageZoomOverlay keyframe={{ ...kf, x: 0, y: 0, scale: 2 }} />);
    const frame = screen.getByTestId('stage-zoom-overlay').querySelector('div') as HTMLElement;
    expect(frame.style.left).toBe('0%');
    expect(frame.style.top).toBe('0%');
  });

  it('clamps at the far edge too', () => {
    render(<StageZoomOverlay keyframe={{ ...kf, x: 100, y: 100, scale: 2 }} />);
    const frame = screen.getByTestId('stage-zoom-overlay').querySelector('div') as HTMLElement;
    expect(frame.style.left).toBe('50%');
  });

  it('never lets the overlay swallow clicks meant for the video', () => {
    render(<StageZoomOverlay keyframe={kf} />);
    expect(screen.getByTestId('stage-zoom-overlay')).toHaveStyle({ pointerEvents: 'none' });
  });
});
