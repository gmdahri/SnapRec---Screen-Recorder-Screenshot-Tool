import { useCallback, useEffect, useRef } from 'react';
import { fetchWithAuth } from './useRecordings';
import { isSessionExpired } from '../lib/sessionExpired';
import { mergeIntervals, type Interval } from '../lib/intervals';

/** P7 V4 — reports which seconds of a recording were actually watched.
 *
 * Accumulates locally and flushes on a timer, because a heartbeat per
 * `timeupdate` would be four requests a second per viewer. Ranges are merged
 * before sending so a viewer who loops a section does not send a growing list.
 *
 * Flushes on pagehide as well as on the timer: closing the tab is the single
 * most common way a watch ends, and without it the last stretch — often the
 * whole session on a short clip — is never counted.
 *
 * Anonymous viewers still call this. The server accepts and discards it (plan
 * O2); doing the filtering server-side keeps one rule in one place rather than
 * having the client decide what it is allowed to be counted for. */

const FLUSH_EVERY_MS = 10_000;
/** Gaps larger than this mean a seek, not continuous watching. */
const CONTINUITY_SEC = 2;

export function useWatchProgress(recordingId: string | undefined, playing: boolean) {
  const pending = useRef<Interval[]>([]);
  const openFrom = useRef<number | null>(null);
  const lastSeen = useRef<number | null>(null);
  /** Set once the server refuses the session. Every later beat would carry
   * the same dead token and get the same 401 every ten seconds; and sent
   * without one it would be discarded, since only signed-in watching is
   * counted. So the heartbeat simply stops for this page — quietly: a lost
   * statistic is not something to tell the viewer about. A fresh sign-in
   * reloads the page and starts a new one. */
  const stopped = useRef(false);

  const flush = useCallback(() => {
    if (!recordingId || stopped.current) return;
    const ranges = mergeIntervals(pending.current);
    if (ranges.length === 0) return;
    pending.current = [];
    // Fire and forget: a dropped heartbeat costs a few seconds of a statistic,
    // and must never surface as an error on a page someone is watching.
    void fetchWithAuth(`/recordings/${recordingId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ ranges }),
    }, { quiet: true }).catch((error) => {
      if (isSessionExpired(error)) {
        stopped.current = true;
        pending.current = [];
      }
    });
  }, [recordingId]);

  /** Called on each clock update while playing. */
  const observe = useCallback((currentSec: number) => {
    const previous = lastSeen.current;
    lastSeen.current = currentSec;

    // A jump means a seek: close the range that was open and start a new one,
    // so skipped footage is never counted as watched.
    if (previous === null || Math.abs(currentSec - previous) > CONTINUITY_SEC) {
      if (openFrom.current !== null && previous !== null && previous > openFrom.current) {
        pending.current.push({ startSec: openFrom.current, endSec: previous });
      }
      openFrom.current = currentSec;
      return;
    }
    if (openFrom.current === null) openFrom.current = currentSec;
  }, []);

  // Close the open range whenever playback stops, so a pause is not counted.
  useEffect(() => {
    if (playing) return;
    if (openFrom.current !== null && lastSeen.current !== null
        && lastSeen.current > openFrom.current) {
      pending.current.push({ startSec: openFrom.current, endSec: lastSeen.current });
    }
    openFrom.current = null;
  }, [playing]);

  useEffect(() => {
    const timer = setInterval(flush, FLUSH_EVERY_MS);
    const onHide = () => {
      if (openFrom.current !== null && lastSeen.current !== null
          && lastSeen.current > openFrom.current) {
        pending.current.push({ startSec: openFrom.current, endSec: lastSeen.current });
        openFrom.current = null;
      }
      flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, [flush]);

  return { observe };
}
