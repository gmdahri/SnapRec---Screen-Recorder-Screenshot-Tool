import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharedList, type SharedCapture } from '../Shared';

const items: SharedCapture[] = [
  { id: 'a', title: 'Checkout button misaligned on mobile Safari', kind: 'recording',
    visibility: 'link', views: 18, commentCount: 3, needsReply: true,
    lastActor: 'Sam Ortiz', lastActivityAt: '2026-08-08T10:00:00Z' },
  { id: 'b', title: 'Sprint 24 release walkthrough', kind: 'recording',
    visibility: 'restricted', views: 31, commentCount: 0, needsReply: false,
    lastActor: null, lastActivityAt: '2026-08-07T10:00:00Z' },
  { id: 'c', title: 'Draft invoice email states', kind: 'screenshot',
    visibility: 'off', views: 0, commentCount: 0, needsReply: false,
    lastActor: null, lastActivityAt: '2026-07-30T10:00:00Z' },
];

describe('Shared', () => {
  it('leads with what is owed, not with what is newest', () => {
    render(<SharedList items={items} onAction={() => {}} />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(titles[0]).toContain('Checkout button misaligned');
  });

  it('shows who can see each capture — permissions are the point', () => {
    render(<SharedList items={items} onAction={() => {}} />);
    expect(screen.getByText('Anyone with the link')).toBeInTheDocument();
    expect(screen.getByText('Only people I invite')).toBeInTheDocument();
  });

  it('says a link was turned off, and offers to turn it back on', () => {
    render(<SharedList items={items} onAction={() => {}} />);
    expect(screen.getByText(/you turned this link off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn sharing on' })).toBeInTheDocument();
  });

  it('leads a needs-a-reply item with its reply action', () => {
    render(<SharedList items={items} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Open and reply' })).toBeInTheDocument();
  });

  it('names the needs-a-reply state in words, not only in coral', () => {
    render(<SharedList items={items} onAction={() => {}} />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('says nothing is shared rather than rendering an empty table', () => {
    render(<SharedList items={[]} onAction={() => {}} />);
    expect(screen.getByText(/You haven't shared anything yet/)).toBeInTheDocument();
  });
});
