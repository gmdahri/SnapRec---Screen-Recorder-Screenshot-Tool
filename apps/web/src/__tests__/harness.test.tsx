import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapturePlate } from '@snaprec/design-system';

/** Proves the harness P3–P6 depend on: jsdom renders, the design system
 * resolves through the workspace, and jest-dom matchers are registered. */
describe('web test harness', () => {
  it('renders a design-system component', () => {
    render(<CapturePlate title="Test" meta="recording · now" kind="recording" status="ready" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
