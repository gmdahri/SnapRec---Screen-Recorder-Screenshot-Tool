import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineZoom, ZOOM_STEPS, clampZoomStep, stepZoom } from '../TimelineZoom';

describe('the zoom ladder', () => {
  it('snaps a stray value onto the nearest step', () => {
    expect(clampZoomStep(1.7)).toBe(1.5);
    expect(clampZoomStep(2.4)).toBe(2);
    expect(clampZoomStep(99)).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    expect(clampZoomStep(0.1)).toBe(1);
  });

  it('steps up and down the ladder', () => {
    expect(stepZoom(2, 1)).toBe(3);
    expect(stepZoom(2, -1)).toBe(1.5);
  });

  it('stops at both ends rather than running off', () => {
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(8, 1)).toBe(8);
  });
});

describe('the control', () => {
  it('reads back the level that is applied', () => {
    render(<TimelineZoom zoom={3} onChange={() => {}} />);
    expect(screen.getByTestId('timeline-zoom-value')).toHaveTextContent('3×');
  });

  it('zooms in and out', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimelineZoom zoom={2} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Zoom timeline in' }));
    expect(onChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Zoom timeline out' }));
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  /** A disabled control must say when it becomes available, or it is a dead end. */
  it('says why it cannot zoom out further', () => {
    render(<TimelineZoom zoom={1} onChange={() => {}} />);
    const out = screen.getByRole('button', { name: 'Zoom timeline out' });
    expect(out).toBeDisabled();
    expect(out).toHaveAttribute('title', 'Already showing the whole clip');
  });

  it('says why it cannot zoom in further', () => {
    render(<TimelineZoom zoom={8} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zoom timeline in' })).toBeDisabled();
  });

  /** The editor already has a zoom that magnifies the picture. Two controls
   * called "zoom" on one screen is how people scale the wrong thing. */
  it('names itself as the timeline’s zoom, not the picture’s', () => {
    render(<TimelineZoom zoom={1} onChange={() => {}} />);
    const named = screen.getAllByRole('button').map(b => b.getAttribute('aria-label'));
    expect(named).toEqual(['Zoom timeline out', 'Zoom timeline in']);
  });
});
