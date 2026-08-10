const FALLBACK = '/home';

export function encodeReturnTo(path: string): string {
  return encodeURIComponent(path);
}

/** Always returns a safe, same-origin, absolute path.
 *
 * An auth callback that redirects to an attacker-supplied URL is an open
 * redirect, and this one is reachable by anyone who can craft a link — the
 * classic phishing shape is a real snaprecorder.org sign-in that lands the
 * victim somewhere else.
 *
 * The guard is a whitelist, not a blacklist of known-bad prefixes: exactly one
 * leading slash, no backslash, no colon, no control characters. Browsers strip
 * tabs and newlines from URLs before parsing, so `/\tjavascript:x` becomes
 * `/javascript:x` — which is why they are rejected outright rather than
 * trimmed. */
export function decodeReturnTo(raw: string | null): string {
  if (!raw) return FALLBACK;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return FALLBACK;
  }

  // Control characters first: a browser strips them before it parses, so any
  // check after this point would be inspecting a different string than the one
  // the browser actually navigates to. Written as escapes rather than literal
  // control characters — the literals are invisible in an editor and a stray
  // reformat would silently widen or empty the class.
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return FALLBACK;

  if (!decoded.startsWith('/')) return FALLBACK;
  if (decoded.startsWith('//')) return FALLBACK;
  if (decoded.includes('\\')) return FALLBACK;

  // Also rejects a legitimate `?t=1:30`. No route needs one, and parsing
  // enough URL grammar to allow it safely is not worth the risk — encode it as
  // %3A at the call site if a route ever does.
  if (decoded.includes(':')) return FALLBACK;

  return decoded;
}

export function buildAuthRedirect(origin: string, returnTo: string): string {
  return `${origin}/auth/callback?returnTo=${encodeReturnTo(returnTo)}`;
}
