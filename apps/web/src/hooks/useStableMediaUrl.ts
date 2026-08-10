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
 * The pinned URL carries the expiry it was signed with — an hour. A tab left
 * open longer than that will find seeks past the buffered range failing, which
 * is the same thing that would happen to a video mid-playback anyway, and a far
 * smaller problem than restarting playback every few seconds. */

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
  if (!sameMediaObject(pinned.current, url)) pinned.current = url;
  return pinned.current;
}
