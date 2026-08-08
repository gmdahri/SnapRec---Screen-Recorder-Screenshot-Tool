import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CaptureRow } from '../primitives/CaptureRow';
import { ActivityRow } from '../primitives/ActivityRow';

const row = {
  title: 'Sprint 24 release walkthrough',
  kind: 'recording' as const,
  length: '6:38',
  created: '2h ago',
  size: '21.4 MB',
  collection: 'Internal',
  sharing: 'shared' as const,
  activity: '31 views · 4 comments',
};

describe('CaptureRow', () => {
  it('renders nine columns at desktop width', () => {
    render(<CaptureRow {...row} status="shared" columns={9} />);
    expect(screen.getAllByRole('cell')).toHaveLength(9);
  });

  it('drops size and collection at seven columns', () => {
    render(<CaptureRow {...row} status="shared" columns={7} />);
    expect(screen.queryByText('21.4 MB')).toBeNull();
    expect(screen.queryByText('Internal')).toBeNull();
  });

  it('keeps title, type, length, created and status at five columns', () => {
    render(<CaptureRow {...row} status="shared" columns={5} />);
    expect(screen.getByText(row.title)).toBeInTheDocument();
    expect(screen.getByText('6:38')).toBeInTheDocument();
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  it('carries the edge state rule for a failed upload', () => {
    render(<CaptureRow {...row} status="uploadFailed" />);
    expect(screen.getByTestId('state-rule-left')).toBeInTheDocument();
  });

  it('renders metadata in the mono face', () => {
    render(<CaptureRow {...row} status="shared" />);
    expect(screen.getByText('6:38').style.fontFamily).toBe('var(--sr-font-mono)');
  });
});

describe('ActivityRow', () => {
  it('always carries a capture frame — never a bare notification', () => {
    render(<ActivityRow actor="Sam Ortiz" event="asked a question at 0:39" meta="12m ago" />);
    expect(screen.getByTestId('activity-thumb')).toBeInTheDocument();
  });

  it('marks a needs-a-reply row in coral and in words', () => {
    render(<ActivityRow actor="Sam Ortiz" event="asked a question" meta="12m ago" needsReply />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('fires its inline action', async () => {
    const open = vi.fn();
    render(
      <ActivityRow actor="Sam Ortiz" event="asked a question" meta="12m ago"
        action={{ label: 'Open and reply', onSelect: open }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open and reply' }));
    expect(open).toHaveBeenCalledOnce();
  });
});
