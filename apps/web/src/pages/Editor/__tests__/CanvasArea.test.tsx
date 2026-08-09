import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasArea } from '../components/CanvasArea';

const handleSetZoom = vi.fn();
const initCanvas = vi.fn();
let zoomLevel = 0.4;

vi.mock('../context/EditorContext', () => ({
  useEditor: () => ({
    canvasRef: { current: null },
    canvasWellRef: { current: null },
    isCropping: false,
    capturedImage: 'blob:image',
    zoomLevel,
    handleSetZoom,
    initCanvas,
    handleCropConfirm: vi.fn(),
    handleCropCancel: vi.fn(),
    isInitializing: false,
  }),
}));

describe('the zoom field', () => {
  beforeEach(() => {
    handleSetZoom.mockClear();
    zoomLevel = 0.4;
  });

  const field = () => screen.getByLabelText('Zoom percentage');

  it('shows the current zoom as a percentage', () => {
    render(<CanvasArea />);
    expect(field()).toHaveValue('40');
  });

  it('applies a typed value on Enter', async () => {
    const user = userEvent.setup();
    render(<CanvasArea />);
    await user.clear(field());
    await user.type(field(), '150{Enter}');
    expect(handleSetZoom).toHaveBeenCalledWith(1.5);
  });

  it('applies a typed value when the field loses focus', async () => {
    const user = userEvent.setup();
    render(<CanvasArea />);
    await user.clear(field());
    await user.type(field(), '75');
    await user.tab();
    expect(handleSetZoom).toHaveBeenCalledWith(0.75);
  });

  it('keeps the current zoom when the text is not a number', async () => {
    const user = userEvent.setup();
    render(<CanvasArea />);
    await user.clear(field());
    await user.type(field(), 'abc{Enter}');
    expect(handleSetZoom).not.toHaveBeenCalled();
    expect(field()).toHaveValue('40');
  });

  it('abandons the edit on Escape', async () => {
    const user = userEvent.setup();
    render(<CanvasArea />);
    await user.clear(field());
    await user.type(field(), '300{Escape}');
    expect(handleSetZoom).not.toHaveBeenCalled();
    expect(field()).toHaveValue('40');
  });

  it('still offers the buttons either side of it', async () => {
    const user = userEvent.setup();
    render(<CanvasArea />);
    await user.click(screen.getByTitle('Zoom in'));
    expect(handleSetZoom).toHaveBeenCalledWith(0.5);
  });
});
