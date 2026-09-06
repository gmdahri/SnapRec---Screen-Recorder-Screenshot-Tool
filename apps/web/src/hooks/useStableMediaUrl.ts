import { useRef } from 'react';

/** Holds a media URL still while the signature on it churns.
 *
 * `fileUrl` comes back from the server presigned, and the signature is different
 * on every fetch — two reads a second apart return different query strings for
 * the same object. Anything that invalidates the recording (posting a comment,
 * saving a description, the readiness poll) therefore handed the `<video>` a new
 * `src`, and a new `src` means the element throws away what it has buffered and
 * starts over at 0:00. From the outside that looks exactly like the page
 * reloading itself the moment you type something.
 *
 * The path identifies the object; the query only proves you may read it. So the
 * first URL seen for a path is the one that keeps being used, and a genuinely
 * different file still swaps as it should.
 *
 * Near expiry, accept a newly signed URL. The player preserves its position
 * when reloading a signature for the same object. */

export function expiresSoon(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const params = new URL(url).searchParams;
    const stamp = params.get('X-Amz-Date');
    const seconds = Number(params.get('X-Amz-Expires'));
    if (!stamp || !seconds) return false;
    const iso = stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
    return Date.parse(iso) + seconds * 1000 <= Date.now() + 90000;
  } catch { return false; }
}

/** Whether two URLs address the same stored object, signature aside. */
export function sameMediaObject(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b;
  if (a === b) return true;
  // A blob: URL has no meaningful path to compare, and it is already stable.
  if (a.startsWith('blob:') || b.startsWith('blob:')) return false;
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    // Not absolute: fall back to comparing everything before the query.
    return a.split('?')[0] === b.split('?')[0];
  }
}

export function useStableMediaUrl(url: string | null | undefined): string | undefined {
  const pinned = useRef<string | undefined>(undefined);
  if (!url) {
    pinned.current = undefined;
    return undefined;
  }
  if (!sameMediaObject(pinned.current, url) || expiresSoon(pinned.current)) pinned.current = url;
  return pinned.current;
}
