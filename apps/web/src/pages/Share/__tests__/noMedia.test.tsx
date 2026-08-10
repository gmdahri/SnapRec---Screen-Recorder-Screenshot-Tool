import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivateCapture } from '../PrivateCapture';
import { ProcessingCapture } from '../ProcessingCapture';

const noop = () => {};

describe('private capture (C5)', () => {
  it('names the owner and offers one action', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={noop} />);
    expect(screen.getByText(/Priya Raman/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request access/ })).toBeInTheDocument();
  });

  it('is not an error — no coral anywhere', () => {
    const { container } = render(<PrivateCapture owner="Priya Raman" onRequestAccess={noop} />);
    expect(container.innerHTML).not.toContain('coral');
  });

  it('draws no frame and no registration marks — there is no media', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={noop} />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('is the only share surface that carries promotion', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={noop} />);
    expect(screen.getByText('What is SnapRec?')).toBeInTheDocument();
  });
});

describe('processing capture (C6)', () => {
  const capture = {
    title: 'Sprint demo', owner: 'Priya Raman',
    duration: '6:38', dimensions: '1920×1080',
  };

  it('shows what is already known so the page is useful immediately', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.getByText('Sprint demo')).toBeInTheDocument();
    expect(screen.getByText(/6:38/)).toBeInTheDocument();
    expect(screen.getByText(/1920×1080/)).toBeInTheDocument();
  });

  it('uses the indeterminate sweep, not a percentage', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.getByTestId('sweep')).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });

  it('keeps the frame passive — nothing to focus on yet', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
    expect(screen.queryAllByTestId('handle')).toHaveLength(0);
  });

  it('announces processing once, politely, and does not poll-announce', () => {
    render(<ProcessingCapture capture={capture} />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('processing');
    expect(live.dataset.announceOnce).toBe('true');
  });

  it('reserves the media box so the page does not reflow when it arrives', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.getByTestId('media-reservation')).toBeInTheDocument();
  });
});
