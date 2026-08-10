import { useCallback, useState } from 'react';

/** Lengths learned from the media elements already on screen.
 *
 * Nothing persists a recording's duration. The database has a `durationSec`
 * column, but no entity maps it, no DTO accepts it and no client sends it — so
 * the `duration` the web app asks for never arrives and every card renders its
 * length as blank. The `<video>` each card already mounts for its thumbnail
 * knows the answer, so cards report it here as metadata loads and the plate
 * reads it back.
 *
 * This is a display-time fallback, not storage: it is only known for cards that
 * have been on screen, and only for files whose header carries a duration. The
 * durable fix is to write `durationSec` at upload. */
export function useCaptureDurations() {
  const [seen, setSeen] = useState<Record<string, number>>({});

  const note = useCallback((id: string, seconds: number) => {
    setSeen(prev => (prev[id] === seconds ? prev : { ...prev, [id]: seconds }));
  }, []);

  return { seen, note };
}
