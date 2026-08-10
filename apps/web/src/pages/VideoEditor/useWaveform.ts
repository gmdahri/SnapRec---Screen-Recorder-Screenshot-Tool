import { useEffect, useRef, useState } from 'react';
import { DEFAULT_BUCKETS, peaksFromBuffer } from './waveform';
import { rmsDbfs } from './loudness';

/** P7 E2.5 — fetches and decodes a clip's audio once, for the AUDIO lane.
 *
 * Cached per URL for the life of the tab. Decoding is the expensive part and a
 * clip's audio does not change under the same presigned URL, so switching tools
 * or re-rendering the timeline must not pay for it twice.
 *
 * Every failure path ends in an empty lane rather than an error: a missing
 * waveform is cosmetic, and no editor should refuse to open because it could
 * not draw a decorative strip. The reasons are real — an expired presigned URL,
 * a codec the browser will not decode, a recording with no microphone. */

const cache = new Map<string, { peaks: number[]; loudnessDbfs: number | null }>();

export interface WaveformState {
  peaks: number[];
  loading: boolean;
  /** RMS of the whole track, dBFS. Null when there is no audio to measure.
   * Taken here because the buffer is already decoded — measuring it separately
   * would mean decoding the file twice. */
  loudnessDbfs: number | null;
}

export function useWaveform(src: string | null | undefined, buckets = DEFAULT_BUCKETS): WaveformState {
  const [peaks, setPeaks] = useState<number[]>(() => (src ? cache.get(src)?.peaks ?? [] : []));
  const [loudnessDbfs, setLoudness] = useState<number | null>(
    () => (src ? cache.get(src)?.loudnessDbfs ?? null : null),
  );
  const [loading, setLoading] = useState(false);
  // Guards against a slow decode landing after the user switched clips.
  const wanted = useRef(src);

  useEffect(() => {
    wanted.current = src;
    if (!src) { setPeaks([]); setLoudness(null); return; }

    const cached = cache.get(src);
    if (cached) { setPeaks(cached.peaks); setLoudness(cached.loudnessDbfs); return; }

    let cancelled = false;
    const Ctor = typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
    if (!Ctor) return;

    setLoading(true);
    (async () => {
      const ctx = new Ctor();
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const bytes = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes);
        const next = peaksFromBuffer(decoded, buckets);
        const loud = decoded.numberOfChannels > 0
          ? rmsDbfs(decoded.getChannelData(0)) : null;
        cache.set(src, { peaks: next, loudnessDbfs: loud });
        if (!cancelled && wanted.current === src) { setPeaks(next); setLoudness(loud); }
      } catch {
        // Cached as empty so a clip that cannot be decoded is not re-fetched
        // on every render for the rest of the session.
        cache.set(src, { peaks: [], loudnessDbfs: null });
        if (!cancelled && wanted.current === src) { setPeaks([]); setLoudness(null); }
      } finally {
        void ctx.close().catch(() => {});
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [src, buckets]);

  return { peaks, loading, loudnessDbfs };
}

/** Exposed for tests; the cache is otherwise private to the tab. */
export function __clearWaveformCache() {
  cache.clear();
}
