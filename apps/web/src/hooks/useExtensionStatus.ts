import { useEffect, useState } from 'react';

/** The four cases from scene H5, plus the one the prototype did not have.
 *
 * The distinction that matters to the user is between "install it" and "it is
 * installed but something is wrong" — those take different actions, so they are
 * different states rather than one error.
 *
 * `checking` exists because the honest answer before the ping resolves is "we
 * do not know yet". Initialising to a failure state made every consumer assert
 * a problem for up to the full timeout, and then take it back. */
export type ExtensionStatus =
  | 'checking' | 'connected' | 'notInstalled' | 'notResponding' | 'unsupported';

export interface ExtensionDetectDeps {
  isChromium: boolean;
  ping: () => Promise<{ version: string } | null>;
  timeoutMs?: number;
}

export interface ExtensionState {
  status: ExtensionStatus;
  version?: string;
}

/** Pure, so the genuinely ambiguous boundary — not-installed versus
 * installed-but-silent — is testable rather than buried in a component. */
export async function detectExtension(
  { isChromium, ping, timeoutMs = 1200 }: ExtensionDetectDeps,
): Promise<ExtensionState> {
  if (!isChromium) return { status: 'unsupported' };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const result = await Promise.race([ping(), timeout]);
    if (result === 'timeout') return { status: 'notResponding' };
    if (result === null) return { status: 'notInstalled' };
    return { status: 'connected', version: result.version };
  } catch {
    return { status: 'notResponding' };
  } finally {
    clearTimeout(timer);
  }
}

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID as string | undefined;

function isChromium(): boolean {
  return typeof navigator !== 'undefined' && /Chrome|Chromium|Edg/.test(navigator.userAgent);
}

type ExternalRuntime = {
  sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void;
};

function ping(): Promise<{ version: string } | null> {
  const runtime = (window as unknown as { chrome?: { runtime?: ExternalRuntime } })
    .chrome?.runtime;

  if (!EXTENSION_ID || !runtime?.sendMessage) return Promise.resolve(null);

  return new Promise(resolve => {
    runtime.sendMessage!(EXTENSION_ID, { type: 'PING' }, (response: unknown) => {
      const version = (response as { version?: string } | undefined)?.version;
      resolve(version ? { version } : null);
    });
  });
}

export function useExtensionStatus(): ExtensionState {
  const [state, setState] = useState<ExtensionState>({ status: 'checking' });

  useEffect(() => {
    let live = true;
    detectExtension({ isChromium: isChromium(), ping })
      .then(result => { if (live) setState(result); });
    return () => { live = false; };
  }, []);

  return state;
}
