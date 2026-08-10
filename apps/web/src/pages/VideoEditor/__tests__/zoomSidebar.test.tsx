import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomSidebar, type ZoomSelection } from '../ZoomSidebar';

const region: ZoomSelection = {
  id: 'z1', startMs: 40_040, endMs: 61_880, scale: 1.6,
  source: 'auto', focus: { x: 0.5, y: 0.5 }, originMs: 32_000,
};

const noop = () => {};

describe('zoom region selected (V2)', () => {
  it('does not exist until something is selected', () => {
    const { container } = render(<ZoomSidebar region={null} onChange={noop} onRemove={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the region was placed automatically and lets it be removed', () => {
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    expect(screen.getByText(/placed automatically/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
  });

  it('names where an automatic region came from', () => {
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    expect(screen.getByText(/click at 0:32/)).toBeInTheDocument();
  });

  it('says nothing about provenance for a manual region', () => {
    render(<ZoomSidebar region={{ ...region, source: 'manual' }} onChange={noop} onRemove={noop} />);
    expect(screen.queryByText(/placed automatically/i)).toBeNull();
  });

  it('shows the scale as a value the hand can reach, not a bare slider', () => {
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    const slider = screen.getByRole('slider', { name: /scale/i });
    expect(slider).toHaveAttribute('aria-valuenow', '1.6');
    expect(slider).toHaveAttribute('aria-valuetext', '1.6×');
  });

  it('exposes the focus point as two named fields, not a draggable-only target', () => {
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    expect(screen.getByRole('spinbutton', { name: /horizontal/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /vertical/i })).toBeInTheDocument();
  });

  it('reports a scale change', () => {
    const onChange = vi.fn();
    render(<ZoomSidebar region={region} onChange={onChange} onRemove={noop} />);
    // fireEvent, not userEvent: clear() only works on editable elements and a
    // range input is not one.
    fireEvent.change(screen.getByRole('slider', { name: /scale/i }), { target: { value: '2.2' } });
    expect(onChange).toHaveBeenCalledWith({ scale: 2.2 });
  });

  it('shows the region boundaries as timecodes', () => {
    render(<ZoomSidebar region={region} onChange={noop} onRemove={noop} />);
    // Both bounds share one span, so match the pair rather than each half.
    expect(screen.getByText('0:40 – 1:01')).toBeInTheDocument();
  });

  it('removes the region', async () => {
    const onRemove = vi.fn();
    render(<ZoomSidebar region={region} onChange={noop} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
