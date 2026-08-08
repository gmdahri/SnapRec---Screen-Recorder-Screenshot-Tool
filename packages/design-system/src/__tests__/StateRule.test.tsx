import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StateRule } from '../primitives/StateRule';
import { StatusBadge } from '../primitives/StatusBadge';

describe('StateRule', () => {
  it('draws nothing for states with no rule', () => {
    render(<StateRule status="ready" />);
    expect(screen.queryByTestId('state-rule-bottom')).toBeNull();
  });

  it('draws a full coral rule for a failed upload', () => {
    render(<StateRule status="uploadFailed" />);
    const rule = screen.getByTestId('state-rule-bottom');
    expect(rule).toHaveStyle({ width: '100%' });
    expect(rule.style.background).toBe('var(--sr-coral-text)');
  });

  it('lets progress override the default partial width', () => {
    render(<StateRule status="uploading" progress={42} />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveStyle({ width: '42%' });
  });

  it('draws offline as a dashed grey rule, never coral', () => {
    render(<StateRule status="queuedOffline" />);
    const rule = screen.getByTestId('state-rule-bottom');
    expect(rule.style.background).not.toContain('coral');
    expect(rule.style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('is hidden from assistive tech — the badge carries the word', () => {
    render(<StateRule status="uploadFailed" />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the leading edge rule when asked', () => {
    render(<StateRule status="uploadFailed" edge="left" />);
    expect(screen.getByTestId('state-rule-left')).toBeInTheDocument();
    expect(screen.queryByTestId('state-rule-bottom')).toBeNull();
  });
});

describe('StatusBadge', () => {
  it('is 19px tall', () => {
    render(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge')).toHaveStyle({ height: '19px' });
  });

  it('always renders the word, never colour alone', () => {
    render(<StatusBadge status="upload failed" />);
    expect(screen.getByText('upload failed')).toBeInTheDocument();
  });

  it('reserves coral for the two permitted statuses', () => {
    const { rerender } = render(<StatusBadge status="needs a reply" />);
    expect(screen.getByTestId('badge').style.color).toBe('var(--sr-coral-hover)');
    rerender(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge').style.color).not.toContain('coral');
  });

  it('is outlined, never a filled pill', () => {
    render(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge').style.background).toBe('transparent');
  });
});
