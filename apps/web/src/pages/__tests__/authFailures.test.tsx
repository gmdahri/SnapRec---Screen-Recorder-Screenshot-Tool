import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignInFailed, type SignInFailure } from '../Login/SignInFailed';
import { SessionExpired } from '../SessionExpired';

const noop = () => {};
const KINDS: SignInFailure[] = ['linkUsed', 'wrongBrowser', 'networkDropped', 'adminBlocked'];

const failed = (kind: SignInFailure) =>
  render(<SignInFailed kind={kind} email="maya@northlight.co" onRetry={noop} onGoogle={noop} />);

describe('sign-in failure (A4)', () => {
  it('explains a used link and its lifetime', () => {
    failed('linkUsed');
    expect(screen.getByRole('heading', { name: 'That link has already been used' })).toBeInTheDocument();
    expect(screen.getByText('Sign-in links work once and expire after 15 minutes. Send a new one below.'))
      .toBeInTheDocument();
  });

  it('tells a wrong-browser user which browser to use', () => {
    failed('wrongBrowser');
    expect(screen.getByText(/Open the link in the same browser you requested it from/))
      .toBeInTheDocument();
  });

  it('says nothing was sent when the network dropped', () => {
    failed('networkDropped');
    expect(screen.getByText(/nothing was sent/)).toBeInTheDocument();
  });

  it('sends an admin-blocked user to the approval link, not to disabled email sign-in', () => {
    failed('adminBlocked');
    expect(screen.getByText(/Your workspace admin has not approved SnapRec/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approval link/i })).toBeInTheDocument();
    // Email sign-in is switched off, so offering it here would be a dead end
    // into the one method that cannot work.
    expect(screen.queryByRole('button', { name: /email sign-in/i })).toBeNull();
  });

  it('always offers a way forward', () => {
    for (const kind of KINDS) {
      const { unmount } = failed(kind);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('never apologises or names an internal mechanism', () => {
    for (const kind of KINDS) {
      const { unmount } = failed(kind);
      const text = document.body.textContent!.toLowerCase();
      expect(text).not.toContain('sorry');
      expect(text).not.toContain('oauth');
      expect(text).not.toMatch(/error \d/);
      unmount();
    }
  });
});

describe('session expiry (A5)', () => {
  it('says how long the session lasted and who to sign back in as', () => {
    render(<SessionExpired email="maya@northlight.co" onSignIn={noop} />);
    expect(screen.getByText(/signed out after 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/maya@northlight.co/)).toBeInTheDocument();
  });

  it('names unsaved work rather than losing it silently', () => {
    render(<SessionExpired email="maya@northlight.co" onSignIn={noop}
      unsavedWork={{ title: 'Follow-up for Brightline demo', kind: 'edit' }} />);
    expect(screen.getByText(/One unsaved/)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up for Brightline demo/)).toBeInTheDocument();
  });

  it('says nothing about unsaved work when there is none', () => {
    render(<SessionExpired email="maya@northlight.co" onSignIn={noop} />);
    expect(screen.queryByText(/unsaved/)).toBeNull();
  });

  it('is not an error — no coral', () => {
    const { container } = render(<SessionExpired email="m@x.co" onSignIn={noop} />);
    expect(container.innerHTML).not.toContain('coral');
  });
});
