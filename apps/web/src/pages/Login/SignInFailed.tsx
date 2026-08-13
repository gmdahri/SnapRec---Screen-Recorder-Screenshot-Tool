export type SignInFailure = 'linkUsed' | 'wrongBrowser' | 'networkDropped' | 'adminBlocked';

export interface SignInFailedProps {
  kind: SignInFailure;
  email?: string;
  onRetry: () => void;
  onGoogle: () => void;
  onEmailInstead?: () => void;
  onApprovalLink?: () => void;
}

/** A4 — four distinct failures, four distinct recoveries.
 *
 * Error language throughout: what happened, what still works, what to do next.
 * No apology, no blame, no error codes, and no mention of OAuth or any other
 * mechanism the reader did not choose to learn about. */
const COPY: Record<SignInFailure, { title: string; body: string }> = {
  linkUsed: {
    title: 'That link has already been used',
    body: 'Sign-in links work once and expire after 15 minutes. Send a new one below.',
  },
  wrongBrowser: {
    title: 'That link was made for a different browser',
    body: 'Open the link in the same browser you requested it from, or request a new one here.',
  },
  networkDropped: {
    title: 'We could not reach SnapRec',
    body: 'Check your connection and try again — nothing was sent.',
  },
  adminBlocked: {
    title: 'Your workspace has not approved SnapRec',
    // Pointed at the approval link alone while email sign-in is disabled —
    // telling someone to use the one method that no longer works is a dead end.
    body: 'Your workspace admin has not approved SnapRec yet. Send them the approval link — email sign-in is not available yet.',
  },
};

// `onEmailInstead` is intentionally left undestructured: it stays in the props
// contract (no caller passes it today) so restoring the email recovery route is
// a small revert rather than an API change.
export function SignInFailed({
  kind, email, onRetry, onGoogle, onApprovalLink,
}: SignInFailedProps) {
  const copy = COPY[kind];

  return (
    <main style={panel}>
      <h1 style={title}>{copy.title}</h1>
      <p style={body}>{copy.body}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        {kind === 'adminBlocked' ? (
          <button type="button" onClick={onApprovalLink ?? onRetry} style={primary}>
            Send the approval link
          </button>
        ) : (
          <>
            <button type="button" onClick={onRetry} style={primary}>
              {kind === 'networkDropped' ? 'Try again' : `Send a new link${email ? ` to ${email}` : ''}`}
            </button>
            <button type="button" onClick={onGoogle} style={secondary}>
              Continue with Google instead
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const panel = {
  maxWidth: 440, width: '100%',
  background: 'var(--sr-surface-paper)',
  border: '1px solid var(--sr-border-light-soft)',
  padding: 26,
  display: 'flex', flexDirection: 'column', gap: 10,
} as const;

const title = {
  margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
} as const;

const body = {
  margin: 0, fontSize: 13.5, lineHeight: 1.6, maxWidth: '54ch',
  color: 'var(--sr-text-muted-on-light)',
} as const;

const primary = {
  height: 'var(--sr-h-md)', border: 'none',
  background: 'var(--sr-text-primary-on-light)', color: '#fff',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const secondary = {
  height: 'var(--sr-h-md)', border: '1px solid var(--sr-border-light)',
  background: 'transparent', fontSize: 13.5, cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;
