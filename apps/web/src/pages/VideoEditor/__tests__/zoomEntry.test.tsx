import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ZoomEntry, ZoomSidebar, type ZoomSelection } from '../ZoomSidebar';
import { AUTO_ZOOM_SCALE, computeZoomScale, TRANSITION_MS } from '../zoomUtils';

const noop = () => {};

describe('the zoom tool has a way in', () => {
  // Regression: ZoomSidebar returns null with nothing selected, which is right
  // for a properties panel — but it was the *only* thing the zoom workspace
  // rendered, and nothing in the app called addZoomKeyframe. Selecting Zoom
  // showed an empty column and there was no way to create a region at all.
  it('offers a primary action rather than an empty column', () => {
    const onAdd = vi.fn();
    render(<ZoomEntry onAdd={onAdd} suggestionCount={0} />);
    screen.getByRole('button', { name: /add zoom at playhead/i }).click();
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('points at the suggestions when there are some', () => {
    render(<ZoomEntry onAdd={noop} suggestionCount={3} />);
    expect(screen.getByText(/3 suggestions/i)).toBeTruthy();
  });

  it('says nothing about suggestions when there are none', () => {
    render(<ZoomEntry onAdd={noop} suggestionCount={0} />);
    expect(screen.queryByText(/suggestion/i)).toBeNull();
  });

  it('counts one suggestion in the singular', () => {
    render(<ZoomEntry onAdd={noop} suggestionCount={1} />);
    expect(screen.getByText(/1 suggestion(?!s)/i)).toBeTruthy();
  });
});

describe('an accepted suggestion keeps the shot it came from', () => {
  // Accepting is meant to preserve what auto-zoom was already showing, so the
  // region's scale has to be the value the auto curve settles at. These are
  // pinned together so changing one without the other fails here.
  it('settles the auto curve at exactly AUTO_ZOOM_SCALE', () => {
    expect(computeZoomScale(TRANSITION_MS)).toBeCloseTo(AUTO_ZOOM_SCALE, 5);
  });

  it('reports auto provenance rather than claiming the user placed it', () => {
    const region: ZoomSelection = {
      id: 'z1', startMs: 4200, endMs: 7200, scale: AUTO_ZOOM_SCALE,
      source: 'auto', focus: { x: 0.7, y: 0.35 }, originMs: 4200,
    };
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    expect(screen.getByText(/placed automatically/i)).toBeTruthy();
    expect(screen.getByText(/from a click at 0:04/i)).toBeTruthy();
  });
});
