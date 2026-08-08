import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertySidebar } from '../components/PropertySidebar';
import { CropOverlay } from '../components/CropOverlay';

const noop = () => {};

describe('crop mode (I2)', () => {
  const rect = { x: 40, y: 20, w: 1180, h: 640 };

  it('rides the dimensions on the frame, where the hand is', () => {
    render(<CropOverlay rect={rect} onChange={noop} onApply={noop} onCancel={noop} onReset={noop} />);
    expect(screen.getByTestId('crop-dimensions')).toHaveTextContent('1180 × 640');
  });

  it('names every key that changes the crop', () => {
    render(<CropOverlay rect={rect} onChange={noop} onApply={noop} onCancel={noop} onReset={noop} />);
    expect(screen.getByText(/arrows nudge · shift-arrows by 10 · ⏎ applies · esc cancels/))
      .toBeInTheDocument();
  });

  it('gives the mode an exit that is not only Escape', () => {
    render(<CropOverlay rect={rect} onChange={noop} onApply={noop} onCancel={noop} onReset={noop} />);
    expect(screen.getByRole('button', { name: 'Reset to full image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('is the second surface where solid handles are correct', () => {
    render(<CropOverlay rect={rect} onChange={noop} onApply={noop} onCancel={noop} onReset={noop} />);
    expect(screen.getAllByTestId('handle')).toHaveLength(8);
  });

  it('nudges by one with an arrow and ten with shift', async () => {
    const onChange = vi.fn();
    render(<CropOverlay rect={rect} onChange={onChange} onApply={noop} onCancel={noop} onReset={noop} />);
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith({ ...rect, x: 41 });
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith({ ...rect, x: 50 });
  });
});

describe('blur and numbered steps (I3)', () => {
  it('says redaction removes pixels and blur may be reversible', () => {
    render(<PropertySidebar selection={{ kind: 'redaction', w: 250, h: 34 }} onChange={noop} />);
    expect(screen.getByText(/Redact removes the pixels. Blur can sometimes be reversed/))
      .toBeInTheDocument();
  });

  it('shows dimensions only while the object is active', () => {
    const { rerender } = render(
      <PropertySidebar selection={{ kind: 'redaction', w: 250, h: 34 }} onChange={noop} />);
    expect(screen.getByText('redacted · 250 × 34')).toBeInTheDocument();
    rerender(<PropertySidebar selection={null} onChange={noop} />);
    expect(screen.queryByText(/250 × 34/)).toBeNull();
  });

  it('offers renumbering, because steps are content and get reordered', () => {
    render(<PropertySidebar selection={{ kind: 'step', index: 3 }} onChange={noop} />);
    expect(screen.getByRole('button', { name: 'Renumber in order' })).toBeInTheDocument();
  });
});

describe('the property sidebar (I4)', () => {
  it('does not exist when nothing is selected', () => {
    const { container } = render(<PropertySidebar selection={null} onChange={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes text properties as labelled controls, not a colour swatch grid', () => {
    render(<PropertySidebar selection={{ kind: 'text', size: 24, weight: 600 }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: /size/i })).toHaveValue(24);
    expect(screen.getByRole('combobox', { name: /weight/i })).toBeInTheDocument();
  });
});
