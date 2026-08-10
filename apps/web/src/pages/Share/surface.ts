/** Which chrome /v renders.
 *
 * ShareView serves three situations from one route — a capture still sitting on
 * the device, a recording opened from a share link, and everything the redesign
 * has not reached (screenshots, and a recording that failed to load). The choice
 * used to live in two booleans a few hundred lines apart, and both times it went
 * wrong it did so silently: the page still worked, it just wore the wrong skin.
 * Pulling it here makes the rule one readable thing with tests on it. */

export type ViewerSurface =
  /** A capture that has not been uploaded yet. Offers to generate a link. */
  | 'fresh'
  /** A persisted recording. The full viewing surface. */
  | 'shared'
  /** Pre-redesign layout: screenshots, and anything with no recording to show. */
  | 'legacy';

export interface SurfaceInput {
  /** No usable id in the URL, or `?fresh=true`. */
  isFresh: boolean;
  /** The recording query has returned something. */
  hasRecording: boolean;
  /** What is being shown, as far as anything knows yet. */
  kind: 'video' | 'screenshot' | null;
  /** Whether the just-captured file is still held in memory.
   *
   * Present so the rule can state outright that it does not matter. Generating
   * a link navigates to /v/{id} while the blob is still in hand; treating that
   * as "not really a shared recording" is what made the first view of a new
   * share fall back to the legacy layout, fixed only by a reload. The blob picks
   * the player's source, never the page. */
  hasLocalBlob?: boolean;
}

export function chooseViewerSurface({ isFresh, hasRecording, kind }: SurfaceInput): ViewerSurface {
  if (isFresh) return kind === 'video' ? 'fresh' : 'legacy';
  return hasRecording ? 'shared' : 'legacy';
}
