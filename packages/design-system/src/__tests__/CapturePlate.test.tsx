import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CapturePlate } from '../primitives/CapturePlate';

const base = {
  title: 'Checkout button misaligned on mobile Safari',
  meta: 'recording · 2h ago · 7.2 MB',
  kind: 'recording' as const,
  duration: '0:47',
};

describe('CapturePlate', () => {
  it('names its status in words, not colour alone', () => {
    render(<CapturePlate {...base} status="shared" />);
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  it('draws the state rule for in-progress work', () => {
    render(<CapturePlate {...base} status="uploading" progress={62} />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveStyle({ width: '62%' });
  });

  it('shows no media affordance for states that cannot be previewed', () => {
    render(<CapturePlate {...base} status="processing" media={<img alt="preview" />} />);
    expect(screen.queryByAltText('preview')).toBeNull();
  });

  it('renders only the actions it was given', async () => {
    const copy = vi.fn();
    render(
      <CapturePlate {...base} status="shared" actions={[
        { key: 'copy', label: 'Copy link', icon: 'ant-design:link-outlined', onSelect: copy },
      ]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledOnce();
  });

  it('gives a disabled action a reason, never a dead end', () => {
    render(
      <CapturePlate {...base} status="uploading" actions={[
        { key: 'copy', label: 'Copy link', icon: 'ant-design:link-outlined',
          onSelect: () => {}, disabledReason: 'Available once the upload finishes' },
      ]} />,
    );
    const btn = screen.getByRole('button', { name: /Copy link/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('title', 'Available once the upload finishes');
  });

  it('is not selectable in states that forbid it', () => {
    render(<CapturePlate {...base} status="uploading" onSelectToggle={() => {}} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('exposes a checkbox when selection is permitted', () => {
    render(<CapturePlate {...base} status="ready" onSelectToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('uses a passive frame while processing — nothing to focus on yet', () => {
    render(<CapturePlate {...base} status="processing" />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });
});

/** The kind icon used to live inside the duration stamp, so it only appeared
 * when a duration existed — a screenshot has none, and nothing passes
 * `dimensions`, so screenshots carried no indication of what they were. */
describe('CapturePlate says what kind of capture it is', () => {
  it('names a screenshot even though it has no duration', () => {
    render(<CapturePlate {...base} kind="screenshot" duration={undefined} status="ready" />);
    expect(screen.getByText(/Screenshot/)).toBeInTheDocument();
  });

  it('keeps the duration alongside the word for a recording', () => {
    render(<CapturePlate {...base} kind="recording" duration="0:47" status="ready" />);
    const chip = screen.getByTestId('kind-chip');
    expect(chip).toHaveTextContent('Recording');
    expect(chip).toHaveTextContent('0:47');
  });

  it('names a full-page capture in words a reader knows', () => {
    render(<CapturePlate {...base} kind="fullpage" duration={undefined} status="ready" />);
    expect(screen.getByText(/Full page/)).toBeInTheDocument();
  });

  it('still says the kind while the capture is not previewable', () => {
    render(<CapturePlate {...base} kind="screenshot" duration={undefined} status="processing" />);
    expect(screen.getByTestId('kind-chip')).toHaveTextContent('Screenshot');
  });

  it('falls back to dimensions when there is no duration', () => {
    render(<CapturePlate {...base} kind="screenshot" duration={undefined}
      dimensions="1280×720" status="ready" />);
    expect(screen.getByTestId('kind-chip')).toHaveTextContent('1280×720');
  });
});
