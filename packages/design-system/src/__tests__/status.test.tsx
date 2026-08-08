import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAPTURE_STATES, PATH_NODES, STATUS_WORDS, type CaptureStatus } from '../status';
import { StatusBadge } from '../primitives/StatusBadge';
import { PathSpine } from '../primitives/PathSpine';

describe('status vocabulary', () => {
  it('fixes the four path nodes in order', () => {
    expect(PATH_NODES).toEqual(['on this device', 'uploading', 'saved to library', 'link ready']);
  });
});

describe('capture state model', () => {
  it('holds exactly the thirteen states the prototype specifies', () => {
    expect(Object.keys(CAPTURE_STATES).sort()).toEqual([
      'draftEdit', 'exportFailed', 'exporting', 'localOnly', 'processing',
      'processingFailed', 'queuedOffline', 'ready', 'savedPrivately',
      'shared', 'unavailable', 'uploadFailed', 'uploading',
    ]);
  });

  it('never renders a failure state as anything but a full coral rule', () => {
    const failures: CaptureStatus[] = ['uploadFailed', 'processingFailed', 'exportFailed'];
    for (const key of failures) {
      expect(CAPTURE_STATES[key].rule).toBe('coral-full');
      expect(CAPTURE_STATES[key].ruleWidth).toBe('100%');
    }
  });

  it('never renders offline as coral — queued work has not failed', () => {
    expect(CAPTURE_STATES.queuedOffline.rule).toBe('grey-dashed');
  });

  it('states with no media cannot be previewed', () => {
    expect(CAPTURE_STATES.processing.canPreview).toBe(false);
    expect(CAPTURE_STATES.processingFailed.canPreview).toBe(false);
    expect(CAPTURE_STATES.unavailable.canPreview).toBe(false);
  });

  it('only uploaded states can be shared', () => {
    expect(CAPTURE_STATES.localOnly.canShare).toBe(false);
    expect(CAPTURE_STATES.uploading.canShare).toBe(false);
    expect(CAPTURE_STATES.queuedOffline.canShare).toBe(false);
    expect(CAPTURE_STATES.shared.canShare).toBe(true);
  });

  it('every state label appears in the fixed vocabulary', () => {
    for (const def of Object.values(CAPTURE_STATES)) {
      const bare = def.label.replace(/\s\d+%$/, '');
      expect(STATUS_WORDS).toContain(bare);
    }
  });
});

describe('StatusBadge', () => {
  it('renders the status word as text, never colour alone', () => {
    render(<StatusBadge status="needs a reply" />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('uses coral only for the live and needs-a-reply statuses', () => {
    const { rerender } = render(<StatusBadge status="recording" />);
    expect(screen.getByTestId('badge').style.color).toBe('var(--sr-coral-hover)');

    rerender(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge').style.color).not.toContain('coral');
  });
});

describe('PathSpine', () => {
  it('names each node in words as well as treatment', () => {
    render(<PathSpine current={1} />);
    for (const node of PATH_NODES) {
      expect(screen.getByText(node)).toBeInTheDocument();
    }
  });

  it('fills completed nodes in green — the only place green appears', () => {
    render(<PathSpine current={2} state="normal" />);
    const done = screen.getAllByTestId('spine-node').slice(0, 2);
    for (const n of done) expect(n.style.background).toBe('var(--sr-green)');
  });

  it('leaves nodes not yet entered hollow', () => {
    render(<PathSpine current={2} state="normal" />);
    const pending = screen.getAllByTestId('spine-node').slice(3);
    for (const n of pending) expect(n.style.background).toBe('transparent');
  });

  it('draws a tick at the break point when the upload failed', () => {
    render(<PathSpine current={1} state="failed" breakAt={62} />);
    const tick = screen.getByTestId('spine-break');
    expect(tick).toHaveStyle({ left: '62%' });
    expect(tick.style.background).toBe('var(--sr-coral-text)');
  });

  it('draws offline as dashed grey, never coral', () => {
    render(<PathSpine current={1} state="offline" />);
    const seg = screen.getByTestId('spine-segment-1');
    expect(seg.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(seg.style.background).not.toContain('coral');
  });

  it('is a progressbar with a live value', () => {
    render(<PathSpine current={1} state="normal" progress={62} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
  });

  it('says stopped in its accessible value when the path failed', () => {
    render(<PathSpine current={1} state="failed" breakAt={62} />);
    expect(screen.getByRole('progressbar'))
      .toHaveAttribute('aria-valuetext', 'uploading — stopped');
  });
});
