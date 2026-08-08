import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CaptureFrame } from '../primitives/CaptureFrame';

describe('CaptureFrame', () => {
  it('draws four corner marks when focused', () => {
    render(<CaptureFrame treatment="focused" />);
    expect(screen.getAllByTestId('registration-mark')).toHaveLength(4);
  });

  it('draws no marks when passive — nothing to focus on yet', () => {
    render(<CaptureFrame treatment="passive" />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('draws solid handles only when editable', () => {
    render(<CaptureFrame treatment="editable" />);
    expect(screen.getAllByTestId('handle')).toHaveLength(8);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('uses coral marks for live capture', () => {
    render(<CaptureFrame treatment="focused" tone="coral" />);
    const mark = screen.getAllByTestId('registration-mark')[0];
    expect(mark.style.borderTopColor).toBe('var(--sr-coral-mark)');
  });

  it('renders its children inside the frame', () => {
    render(<CaptureFrame treatment="focused"><span>preview</span></CaptureFrame>);
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('marks the frame decorative — the surface names its own state', () => {
    render(<CaptureFrame treatment="focused" />);
    for (const m of screen.getAllByTestId('registration-mark')) {
      expect(m).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
