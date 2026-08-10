import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel, type PropertiesPanelProps } from '../PropertiesPanel';

const base: PropertiesPanelProps = {
  trimStartSec: 18,
  trimEndSec: 119,
  durationSec: 182,
  onTrimStartChange: () => {},
  onTrimEndChange: () => {},
  outputFormat: 'WebM · VP9',
};

describe('trim group', () => {
  it('shows the trim points as timecodes', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByText('0:18')).toBeInTheDocument();
    expect(screen.getByText('1:59')).toBeInTheDocument();
  });

  it('bounds the sliders by the clip, not by a guess', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByLabelText('Start')).toHaveAttribute('max', '182');
    expect(screen.getByLabelText('End')).toHaveAttribute('max', '182');
  });

  it('reports a drag to the caller', () => {
    const onTrimStartChange = vi.fn();
    render(<PropertiesPanel {...base} onTrimStartChange={onTrimStartChange} />);
    // fireEvent.change goes through React's value tracker; a raw dispatched
    // event on a controlled input is swallowed.
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '40' } });
    expect(onTrimStartChange).toHaveBeenCalledWith(40);
  });

  /** Trim maths divide by the clip length. With none, the sliders would span a
   * range of zero and every drag would be meaningless. */
  it('locks trimming, and says why, until the clip reports its length', () => {
    render(<PropertiesPanel {...base} durationSec={0} />);
    expect(screen.getByLabelText('Start')).toBeDisabled();
    expect(screen.getByTestId('properties-panel'))
      .toHaveTextContent(/unlocks once the clip reports its length/i);
  });
});

describe('clean up group', () => {
  const names = ['Remove silences', 'Blur cursor trail', 'Normalize audio'];

  it('offers the three clean-up controls', () => {
    render(<PropertiesPanel {...base} />);
    names.forEach(n => expect(screen.getByRole('switch', { name: n })).toBeInTheDocument());
  });

  it('still invents no measurements for the two that are unbuilt', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent(/LUFS/);
  });

  /** None of the analysis behind these exists. A toggle that flips but changes
   * nothing is worse than one that admits it is not ready. */
  it('leaves them off and disabled, each saying what it is waiting on', () => {
    render(<PropertiesPanel {...base} />);
    names.forEach(n => {
      const toggle = screen.getByRole('switch', { name: n });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle.getAttribute('title')?.length).toBeGreaterThan(0);
    });
  });

  it('invents no measurements it cannot take', () => {
    render(<PropertiesPanel {...base} />);
    // The mockup's "6 gaps over 1.2s" is a reading nothing computes.
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent(/\d+ gaps/);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent(/LUFS/);
  });
});

describe('output group', () => {
  it('reports the kept length', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByText('1:41')).toBeInTheDocument();
  });

  /** The mockup says MP4 · H.264. Export produces WebM, and claiming otherwise
   * would send people to an editor expecting a file it never writes. */
  it('names the format that is actually produced', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByText('WebM · VP9')).toBeInTheDocument();
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent(/H\.264/);
  });

  /** Both Length and Estimated size read "unknown" without a clip, so this
   * asserts the row rather than the word. */
  it('says the length is unknown rather than showing 0:00', () => {
    render(<PropertiesPanel {...base} durationSec={0} />);
    expect(screen.getAllByText('unknown').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent('Length0:00');
  });
});

describe('output reflects the edit (E4)', () => {
  const cuts = [{ id: 'c1', startSec: 30, endSec: 40 }];

  it('subtracts cuts from the output length', () => {
    render(<PropertiesPanel {...base} cuts={cuts} />);
    // 0:18 to 1:59 is 1:41; ten seconds cut leaves 1:31.
    expect(screen.getByText('1:31')).toBeInTheDocument();
  });

  it('says how much the cuts removed', () => {
    render(<PropertiesPanel {...base} cuts={cuts} />);
    expect(screen.getByTestId('properties-panel')).toHaveTextContent('Removed by cuts');
  });

  it('mentions cuts only when there are some', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent('Removed by cuts');
  });

  /** A heuristic must never look like a measurement. */
  it('marks the size as approximate', () => {
    render(<PropertiesPanel {...base} heightPx={1080} />);
    expect(screen.getByTestId('properties-panel')).toHaveTextContent(/≈ \d/);
  });

  it('declines to estimate a size without a frame height', () => {
    render(<PropertiesPanel {...base} heightPx={0} />);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent('≈');
  });
});

describe('fades (E4.1)', () => {
  const withFades = (over = {}) => render(
    <PropertiesPanel {...base} fadeInSec={0.3} fadeOutSec={0.5}
      onFadeInChange={() => {}} onFadeOutChange={() => {}} {...over} />,
  );

  it('shows fades in seconds, not as a timecode', () => {
    withFades();
    expect(screen.getByText('0.3s')).toBeInTheDocument();
    expect(screen.getByText('0.5s')).toBeInTheDocument();
  });

  it('reports a drag', () => {
    const onFadeInChange = vi.fn();
    withFades({ onFadeInChange });
    fireEvent.change(screen.getByLabelText('Fade in'), { target: { value: '1.2' } });
    expect(onFadeInChange).toHaveBeenCalledWith(1.2);
  });

  /** Shown as applied, not as typed — the export will use the clamped value. */
  it('shows the shortened fade and says it was shortened', () => {
    render(<PropertiesPanel trimStartSec={0} trimEndSec={4} durationSec={4}
      onTrimStartChange={() => {}} onTrimEndChange={() => {}} outputFormat="WebM · VP9"
      fadeInSec={3} fadeOutSec={3} onFadeInChange={() => {}} onFadeOutChange={() => {}} />);
    expect(screen.getByTestId('properties-panel')).toHaveTextContent(/Shortened to fit/);
    expect(screen.queryByText('3.0s')).toBeNull();
  });

  it('offers no fade controls on a clip of unknown length', () => {
    withFades({ durationSec: 0 });
    expect(screen.queryByLabelText('Fade in')).toBeNull();
  });
});

describe('remove silences (E5.1)', () => {
  /** The mockup's "6 gaps over 1.2s" is now a measurement, not decoration. */
  it('reports what it found and offers to act on it', async () => {
    const onRemoveSilences = vi.fn();
    const user = userEvent.setup();
    render(<PropertiesPanel {...base} silenceSummary="6 gaps over 1.2s"
      onRemoveSilences={onRemoveSilences} />);

    const action = screen.getByRole('button', { name: /Remove silences/ });
    expect(action).toHaveTextContent('6 gaps over 1.2s');
    await user.click(action);
    expect(onRemoveSilences).toHaveBeenCalledOnce();
  });

  /** Audio decodes asynchronously; before it lands there is nothing to find. */
  it('waits, and says it is waiting, before the audio has loaded', () => {
    render(<PropertiesPanel {...base} />);
    const toggle = screen.getByRole('switch', { name: 'Remove silences' });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('title', 'waiting for the audio to load');
  });

  /** A clean recording is a normal outcome, not a failure. */
  it('says so when the audio loaded but held no long gaps', () => {
    render(<PropertiesPanel {...base} onRemoveSilences={() => {}} silenceSummary={null} />);
    expect(screen.getByRole('switch', { name: 'Remove silences' }))
      .toHaveAttribute('title', 'no gaps long enough to remove');
  });
});

describe('the one clean-up feature that is still unbuilt', () => {
  /** Blur cursor trail needs metadata the extension does not send, which means
   * a Web Store release — genuinely outside this work. */
  it('says precisely what it is waiting on', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByRole('switch', { name: 'Blur cursor trail' }))
      .toHaveAttribute('title', 'extension does not send cursor data yet');
  });
});

describe('normalize audio (E5.2)', () => {
  it('reports the measured level and can be switched on', async () => {
    const onNormalizeChange = vi.fn();
    const user = userEvent.setup();
    render(<PropertiesPanel {...base} loudnessSummary="-24.3 → -16.0 dBFS RMS"
      onNormalizeChange={onNormalizeChange} />);

    const toggle = screen.getByRole('switch', { name: 'Normalize audio' });
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('properties-panel')).toHaveTextContent('-24.3 → -16.0 dBFS RMS');

    await user.click(toggle);
    expect(onNormalizeChange).toHaveBeenCalledWith(true);
  });

  it('shows it as on when it is on', () => {
    render(<PropertiesPanel {...base} loudnessSummary="-24.3 → -16.0 dBFS RMS"
      normalizeAudio onNormalizeChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Normalize audio' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  /** Calling an RMS figure LUFS would be authoritative-looking and wrong. */
  it('never claims LUFS', () => {
    render(<PropertiesPanel {...base} loudnessSummary="-24.3 → -16.0 dBFS RMS"
      onNormalizeChange={() => {}} />);
    expect(screen.getByTestId('properties-panel')).not.toHaveTextContent(/LUFS/);
  });

  it('waits, and says so, before the audio has loaded', () => {
    render(<PropertiesPanel {...base} />);
    expect(screen.getByRole('switch', { name: 'Normalize audio' }))
      .toHaveAttribute('title', 'waiting for the audio to load');
  });

  it('says there is nothing to measure on a silent recording', () => {
    render(<PropertiesPanel {...base} onNormalizeChange={() => {}} loudnessSummary={null} />);
    expect(screen.getByRole('switch', { name: 'Normalize audio' }))
      .toHaveAttribute('title', 'no audio to measure');
  });
});
