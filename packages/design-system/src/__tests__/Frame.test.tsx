import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Frame } from '../primitives/Frame';

function marks(container: HTMLElement) {
  return container.querySelectorAll('[data-part="mark"]');
}

describe('Frame', () => {
  it('gives editable frames six solid handles', () => {
    const { container } = render(<Frame treatment="editable" />);
    expect(marks(container)).toHaveLength(6);
  });

  it('gives focused frames four inset registration marks', () => {
    const { container } = render(<Frame treatment="focused" />);
    expect(marks(container)).toHaveLength(4);
  });

  it('gives passive frames no marks at all', () => {
    const { container } = render(<Frame treatment="passive" />);
    expect(marks(container)).toHaveLength(0);
  });

  it('shows a dimension readout only for editable frames', () => {
    const { queryByText, rerender } = render(<Frame treatment="editable" readout="840 × 525" />);
    expect(queryByText('840 × 525')).toBeInTheDocument();

    rerender(<Frame treatment="focused" readout="840 × 525" />);
    expect(queryByText('840 × 525')).not.toBeInTheDocument();
  });

  it('renders its children', () => {
    const { getByTestId } = render(
      <Frame treatment="passive"><img data-testid="media" alt="" /></Frame>
    );
    expect(getByTestId('media')).toBeInTheDocument();
  });
});
