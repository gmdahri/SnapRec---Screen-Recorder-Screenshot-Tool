import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InProgress } from '../Home/InProgress';
import { AttentionBand } from '../Home/AttentionBand';
import { ExtensionNotice } from '../Home/ExtensionNotice';

describe('Home — work in progress (H3)', () => {
  const items = [
    { id: '1', title: 'Sprint 24 release walkthrough', status: 'uploading' as const,
      progress: 62, detail: 'uploading 62% · 14.2 of 22.9 MB',
      action: { label: 'Cancel upload', onSelect: () => {} } },
    { id: '2', title: 'Lesson 4 — solving for x', status: 'processing' as const,
      detail: 'processing · usually under a minute',
      action: { label: 'Copy link', onSelect: () => {} } },
    { id: '3', title: 'Follow-up for Brightline demo', status: 'exporting' as const,
      progress: 52, detail: 'exporting 1080p · frame 1284 of 2460',
      action: { label: 'Stop export', onSelect: () => {} } },
  ];

  it('carries progress on the media, not in a separate widget', () => {
    render(<InProgress items={items} />);
    expect(screen.getAllByTestId('state-rule-bottom')).toHaveLength(3);
  });

  it('names bytes and frames, not bare percentages', () => {
    render(<InProgress items={items} />);
    expect(screen.getByText(/14\.2 of 22\.9 MB/)).toBeInTheDocument();
    expect(screen.getByText(/frame 1284 of 2460/)).toBeInTheDocument();
  });

  it('says a processing link already works', () => {
    render(<InProgress items={items} />);
    expect(screen.getByText(/The link already works/)).toBeInTheDocument();
  });

  it('gives each item the primary action its state defines', () => {
    render(<InProgress items={items} />);
    expect(screen.getByRole('button', { name: 'Cancel upload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop export' })).toBeInTheDocument();
  });

  it('renders nothing when there is no work in progress', () => {
    const { container } = render(<InProgress items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Home — attention required (H4)', () => {
  const items = [
    { kind: 'uploadFailed' as const, id: '1', title: 'Nav overlap on 13-inch',
      detail: 'The connection dropped at 46%. The screenshot is still on this device.',
      action: { label: 'Try upload again', onSelect: () => {} } },
    { kind: 'exportFailed' as const, id: '2', title: 'Follow-up for Brightline demo',
      detail: 'Processing stopped at frame 1284. Your edit is saved; the source recording is untouched.',
      action: { label: 'Try export again', onSelect: () => {} } },
    { kind: 'micBlocked' as const, id: '3', title: 'Microphone access is blocked for SnapRec',
      detail: 'Recordings will have no narration until Chrome allows the mic again. Screen and tab audio still work.',
      action: { label: 'How to fix', onSelect: () => {} } },
  ];

  it('states what is still safe before offering the retry', () => {
    render(<AttentionBand items={items} />);
    expect(screen.getByText(/connection dropped at 46%/).textContent)
      .toContain('still on this device');
  });

  it('says the edit survived an export failure', () => {
    render(<AttentionBand items={items} />);
    expect(screen.getByText(/Your edit is saved; the source recording is untouched/))
      .toBeInTheDocument();
  });

  it('names what still works when the mic is blocked', () => {
    render(<AttentionBand items={items} />);
    expect(screen.getByText(/Screen and tab audio still work/)).toBeInTheDocument();
  });

  it('never hides an attention item behind a menu', () => {
    render(<AttentionBand items={items} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('renders nothing when nothing needs attention', () => {
    const { container } = render(<AttentionBand items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Home — extension unavailable (H5)', () => {
  it('says nothing at all while detection is still in flight', () => {
    const { container } = render(<ExtensionNotice status="checking" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for support instead of a status card once the extension is connected', () => {
    // A working setup needs no instruction, so the slot the install prompt used
    // to own carries the support ask rather than "everything is fine".
    render(<ExtensionNotice status="connected" version="2.4" />);
    const link = screen.getByRole('link', { name: /Patreon/i });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('does not ask for support while the extension is missing or broken', () => {
    // Asking someone to fund the thing that is currently failing them reads as
    // tone-deaf, so the ask is gated on a working setup.
    for (const status of ['notInstalled', 'notResponding', 'unsupported'] as const) {
      cleanup();
      render(<ExtensionNotice status={status} />);
      expect(screen.queryByRole('link', { name: /Patreon/i })).toBeNull();
    }
  });

  it('reassures that the library works without the extension', () => {
    render(<ExtensionNotice status="notInstalled" />);
    expect(screen.getByText(/library stays available either way/)).toBeInTheDocument();
  });

  it('offers a copyable extensions URL when installed but unresponsive', () => {
    render(<ExtensionNotice status="notResponding" />);
    expect(screen.getByText(/disabled, or blocked on this page/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy chrome://extensions' })).toBeInTheDocument();
    expect(screen.getByText('chrome://extensions')).toBeInTheDocument();
  });

  it('names what still works on an unsupported browser', () => {
    render(<ExtensionNotice status="unsupported" />);
    expect(screen.getByText(/watch, comment on and download captures here/)).toBeInTheDocument();
  });
});
