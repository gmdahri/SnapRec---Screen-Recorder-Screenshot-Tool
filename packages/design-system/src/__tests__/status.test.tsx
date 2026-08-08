import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAPTURE_STATES, PATH_NODES, STATUS_WORDS, type CaptureStatus } from '../status';
import { StatusChip } from '../primitives/StatusChip';
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

describe('StatusChip', () => {
  it('renders the status word as text, never colour alone', () => {
    render(<StatusChip status="needs a reply" />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('uses coral only for the live and needs-a-reply statuses', () => {
    const { rerender } = render(<StatusChip status="recording" />);
    expect(screen.getByTestId('chip')).toHaveStyle({ background: 'var(--sr-coral-text)' });

    rerender(<StatusChip status="shared" />);
    expect(screen.getByTestId('chip')).not.toHaveStyle({ background: 'var(--sr-coral-text)' });
  });
});

describe('PathSpine', () => {
  it('names all four nodes', () => {
    render(<PathSpine reached={1} />);
    for (const node of PATH_NODES) {
      expect(screen.getByText(new RegExp(node))).toBeInTheDocument();
    }
  });

  it('marks reached nodes complete and leaves the rest hollow', () => {
    render(<PathSpine reached={2} />);
    expect(screen.getAllByTestId('node-complete')).toHaveLength(2);
    expect(screen.getAllByTestId('node-pending')).toHaveLength(2);
  });

  it('turns the bar coral when the path has failed', () => {
    render(<PathSpine reached={1} state="failed" />);
    expect(screen.getByTestId('spine-fill')).toHaveStyle({ background: 'var(--sr-coral-text)' });
  });

  it('uses no error colouring when merely offline', () => {
    render(<PathSpine reached={1} state="offline" />);
    expect(screen.getByTestId('spine-fill')).not.toHaveStyle({ background: 'var(--sr-coral-text)' });
  });
});
