import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInPanel } from '../Login/SignInPanel';
import { ReturnToTask } from '../Login/ReturnToTask';

const noop = () => {};
const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('sign in (A1)', () => {
  const panel = (over = {}) =>
    wrap(<SignInPanel onGoogle={noop} onMagicLink={noop} {...over} />);

  it('says what an account adds rather than what it gates', () => {
    panel();
    expect(screen.getByText(/keeps your captures in one library, lets you rename links, and shows you who watched/))
      .toBeInTheDocument();
  });

  it('promises that existing recordings survive signing in', () => {
    panel();
    expect(screen.getByText('Nothing you have already recorded is lost by signing in.'))
      .toBeInTheDocument();
  });

  it('offers Google and explains that email sign-in is not ready', () => {
    panel();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByText(/Email sign-in is coming soon/i)).toBeInTheDocument();
  });

  it('disables the email field and its button', () => {
    panel();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Send a sign-in link/ })).toBeDisabled();
  });

  it('never sends a link, even if the form is submitted directly', () => {
    const onMagicLink = vi.fn();
    const { container } = panel({ onMagicLink });
    // Disabled controls cannot be clicked, but a form still submits on Enter and
    // can be submitted programmatically — so the refusal lives in the handler
    // rather than resting on the disabled attributes alone.
    fireEvent.submit(container.querySelector('form')!);
    expect(onMagicLink).not.toHaveBeenCalled();
  });

  it('links the terms rather than burying them', () => {
    panel();
    expect(screen.getByRole('link', { name: /Terms/ })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/ })).toHaveAttribute('href', '/privacy');
  });
});

describe('return to task (A2)', () => {
  const pending = {
    title: 'Sprint demo walkthrough',
    meta: '2:14 · recorded 8 min ago',
    kind: 'recording' as const,
    expiresInDays: 7,
  };

  const task = () => wrap(
    <ReturnToTask pending={pending} onGoogle={noop} onMagicLink={noop}
      onShareWithoutAccount={noop} />,
  );

  it('keeps the pending capture visible throughout', () => {
    task();
    expect(screen.getByText('Sprint demo walkthrough')).toBeInTheDocument();
    expect(screen.getByText('2:14 · recorded 8 min ago')).toBeInTheDocument();
  });

  it('says where the user will land afterwards', () => {
    task();
    expect(screen.getByRole('heading', { name: "Sign in and we'll take you back here" }))
      .toBeInTheDocument();
  });

  it('shows the capture is already safe on this device', () => {
    task();
    expect(screen.getByText('on this device')).toBeInTheDocument();
  });

  it('keeps sharing without an account available, and honest about expiry', () => {
    task();
    expect(screen.getByRole('button', { name: /Share without an account/ })).toBeInTheDocument();
    expect(screen.getByText(/expires in 7 days/)).toBeInTheDocument();
  });

  it('never suggests the recording is at risk', () => {
    task();
    const text = document.body.textContent!.toLowerCase();
    expect(text).not.toContain('will be deleted');
    expect(text).not.toContain('you will lose');
  });
});
