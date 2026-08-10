import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorTimeline, type TimelineProject } from '../EditorTimeline';
import { TransportBar } from '../TransportBar';

const project: TimelineProject = {
  durationMs: 182_000,
  trim: { startMs: 14_560, endMs: 156_520 },
  zoomRegions: [
    { id: 'z1', startMs: 40_040, endMs: 61_880, scale: 1.6, source: 'auto' },
    { id: 'z2', startMs: 94_640, endMs: 111_020, scale: 2.0, source: 'manual' },
  ],
  suggestions: [{ id: 's1', atMs: 127_400 }],
  waveform: Array.from({ length: 80 }, (_, i) => (i % 7) / 7),
  playheadMs: 61_880,
};

const noop = () => {};

describe('the timeline (V1)', () => {
  const mount = () => render(
    <EditorTimeline
      project={project} selection={null}
      onSelect={noop} onTrim={noop} onAcceptSuggestion={noop}
    />,
  );

  /** Was three lanes. The P7 redesign adds CUTS, which the mockup shows as its
   * own row — a cut is a distinct kind of edit from a zoom and sharing a lane
   * would make neither readable. The point of the original assertion stands:
   * this is a fixed, small set of lanes, not an open-ended track list. */
  it('has exactly four lanes', () => {
    mount();
    expect(screen.getAllByRole('group').map(g => g.getAttribute('aria-label')))
      .toEqual(['clip', 'zoom', 'cuts', 'audio']);
  });

  it('dims trimmed heads rather than removing them', () => {
    mount();
    const heads = screen.getAllByTestId('trimmed-head');
    expect(heads).toHaveLength(2);
    for (const head of heads) expect(head).toHaveStyle({ opacity: '0.6' });
  });

  it('gives trim points solid handles — the one place they are correct', () => {
    mount();
    expect(screen.getAllByTestId('trim-handle')).toHaveLength(2);
  });

  it('rides the timecode on the handle so the value is where the hand is', () => {
    mount();
    expect(screen.getByTestId('trim-handle-start')).toHaveTextContent('0:14');
    expect(screen.getByTestId('trim-handle-end')).toHaveTextContent('2:36');
  });

  it('distinguishes an auto zoom from a manual one in words', () => {
    mount();
    expect(screen.getByRole('button', { name: /auto 1.6×/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual 2×/ })).toBeInTheDocument();
  });

  it('offers a suggestion for acceptance, since its tooltip says so', () => {
    const onAcceptSuggestion = vi.fn();
    render(
      <EditorTimeline
        project={project} selection={null}
        onSelect={noop} onTrim={noop} onAcceptSuggestion={onAcceptSuggestion}
      />,
    );
    // Regression: this was a <span> with a "click to accept" title and no
    // handler, and nothing in the app ever created a zoom region as a result.
    screen.getByRole('button', { name: /accept auto zoom suggestion/i }).click();
    expect(onAcceptSuggestion).toHaveBeenCalledWith('s1');
  });

  it('shows an unaccepted suggestion as a mark, not a region', () => {
    mount();
    expect(screen.getByTestId('zoom-suggestion').dataset.accepted).toBe('false');
  });

  it('selects a zoom region on click', async () => {
    const onSelect = vi.fn();
    render(
      <EditorTimeline
        project={project} selection={null}
        onSelect={onSelect} onTrim={noop} onAcceptSuggestion={noop}
      />,
    );
    screen.getByRole('button', { name: /auto 1.6×/ }).click();
    expect(onSelect).toHaveBeenCalledWith('z1');
  });
});

describe('the transport bar', () => {
  const bar = (over = {}) => render(
    <TransportBar playing={false} zoomLabel="fit" isApple
      onPlay={noop} onStep={noop} onSplit={noop} onAddZoom={noop} onTimelineZoom={noop}
      {...over} />,
  );

  it('offers exactly two editing verbs', () => {
    bar();
    const verbs = screen.getAllByRole('button')
      .map(b => b.textContent?.trim())
      .filter(t => t === 'Split' || t === 'Add zoom');
    expect(verbs).toEqual(['Split', 'Add zoom']);
  });

  it('names the shortcut on every icon-only control', () => {
    bar();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('title', 'Play — space');
    expect(screen.getByRole('button', { name: 'Next edit point' }))
      .toHaveAttribute('title', 'Next edit point — →');
  });
});
