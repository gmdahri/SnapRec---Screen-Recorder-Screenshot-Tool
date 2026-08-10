import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('offers Google and a one-time link, and says the link is passwordless', () => {
    panel();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByText('No password. We send a one-time link.')).toBeInTheDocument();
  });

  it('validates the email before sending', async () => {
    const onMagicLink = vi.fn();
    panel({ onMagicLink });
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /Send a sign-in link/ }));
    expect(onMagicLink).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('sends the link for a valid address', async () => {
    const onMagicLink = vi.fn();
    panel({ onMagicLink });
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'maya@northlight.co');
    await userEvent.click(screen.getByRole('button', { name: /Send a sign-in link/ }));
    expect(onMagicLink).toHaveBeenCalledWith('maya@northlight.co');
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
