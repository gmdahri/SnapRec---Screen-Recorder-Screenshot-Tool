import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Switch } from '../primitives/Switch';
import { Mono } from '../primitives/Mono';

describe('control heights', () => {
  it('exposes exactly six, so a surface cannot invent a seventh', () => {
    const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');
    const heights = [...css.matchAll(/--sr-h-[a-z0-9]+:\s*(\d+)px/g)].map(m => m[1]);
    expect(heights.sort()).toEqual(['30', '32', '34', '36', '40', '46']);
  });
});

const SOURCES = [
  { value: 'tab', label: 'This tab' },
  { value: 'window', label: 'Window' },
  { value: 'screen', label: 'Screen' },
];

describe('SegmentedControl', () => {
  it('exposes radiogroup semantics with a label', () => {
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Recording source' })).toBeInTheDocument();
  });

  it('marks exactly one option checked', () => {
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={() => {}} />);
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Window' }));
    expect(onChange).toHaveBeenCalledWith('window');
  });
});

describe('Switch', () => {
  it('exposes switch semantics and toggles', async () => {
    const onChange = vi.fn();
    render(<Switch label="Microphone" checked={false} onChange={onChange} />);
    const el = screen.getByRole('switch', { name: 'Microphone' });
    expect(el).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(el);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Mono', () => {
  it('uses tabular numerals so timers do not jitter', () => {
    render(<Mono>02:14</Mono>);
    expect(screen.getByText('02:14')).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });
});
