import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorTimeline, type TimelineProject } from '../EditorTimeline';

const project = (over: Partial<TimelineProject> = {}): TimelineProject => ({
  durationMs: 180_000,
  trim: { startMs: 0, endMs: 180_000 },
  zoomRegions: [],
  suggestions: [],
  cuts: [
    { id: 'cut-1', startMs: 60_000, endMs: 70_000 },
    { id: 'cut-2', startMs: 120_000, endMs: 121_000 },
  ],
  playheadMs: 0,
  ...over,
});

const noop = () => {};
const base = {
  selection: null as string | null,
  onSelect: noop,
  onTrim: noop,
  onAcceptSuggestion: noop,
};

describe('the cuts lane', () => {
  it('draws a chip for each cut, placed on the clock', () => {
    render(<EditorTimeline {...base} project={project()} />);
    const lane = screen.getByRole('group', { name: 'cuts' });
    expect(within(lane).getAllByRole('button')).toHaveLength(2);

    const first = within(lane).getByRole('button', { name: 'Cut from 1:00 to 1:10' });
    expect(first.style.left).toBe(`${(60_000 / 180_000) * 100}%`);
  });

  it('is empty, not absent, when nothing has been cut', () => {
    render(<EditorTimeline {...base} project={project({ cuts: [] })} />);
    const lane = screen.getByRole('group', { name: 'cuts' });
    expect(within(lane).queryAllByRole('button')).toHaveLength(0);
  });

  it('survives a project saved before cuts existed', () => {
    const { cuts, ...withoutCuts } = project();
    void cuts;
    render(<EditorTimeline {...base} project={withoutCuts as TimelineProject} />);
    expect(screen.getByRole('group', { name: 'cuts' })).toBeInTheDocument();
  });

  it('selects a cut when its chip is clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<EditorTimeline {...base} onSelect={onSelect} project={project()} />);
    await user.click(screen.getByRole('button', { name: 'Cut from 1:00 to 1:10' }));
    expect(onSelect).toHaveBeenCalledWith('cut-1');
  });

  it('marks the selected chip as pressed', () => {
    render(<EditorTimeline {...base} selection="cut-1" project={project()} />);
    expect(screen.getByRole('button', { name: 'Cut from 1:00 to 1:10' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('restores the footage on a double-click', async () => {
    const onRemoveCut = vi.fn();
    const user = userEvent.setup();
    render(<EditorTimeline {...base} onRemoveCut={onRemoveCut} project={project()} />);
    await user.dblClick(screen.getByRole('button', { name: 'Cut from 1:00 to 1:10' }));
    expect(onRemoveCut).toHaveBeenCalledWith('cut-1');
  });

  /** A one-second cut on a three-minute timeline is half a pixel wide; without
   * a floor it cannot be clicked to undo. */
  it('keeps a very short cut wide enough to hit', () => {
    render(<EditorTimeline {...base} project={project()} />);
    const short = screen.getByRole('button', { name: 'Cut from 2:00 to 2:01' });
    expect(short.style.minWidth).toBe('2px');
  });

  /** Coral is reserved for live capture and needs-a-response. */
  it('does not spend coral on ordinary cuts', () => {
    render(<EditorTimeline {...base} project={project()} />);
    const lane = screen.getByRole('group', { name: 'cuts' });
    expect(lane.outerHTML).not.toMatch(/coral/);
  });

  it('says how to remove a cut rather than leaving it a mystery', () => {
    render(<EditorTimeline {...base} onRemoveCut={noop} project={project()} />);
    expect(screen.getByRole('button', { name: 'Cut from 1:00 to 1:10' }))
      .toHaveAttribute('title', 'Double-click to restore this footage');
  });
});
