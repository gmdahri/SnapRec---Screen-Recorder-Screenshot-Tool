import { useEffect } from 'react';
import { fetchWithAuth, type Recording } from './useRecordings';
import { getConsent } from '../lib/consent';
import { capture } from '../lib/analytics';

/** Consent-aware, session-deduplicated view after five visible seconds.
 * Videos must be playing; image views require a loaded image. Metadata fetches never count.
 */
export function useQualifiedView(recording: Recording | undefined, userId?: string) {
  useEffect(() => {
    if (!recording || recording.isReady === false || (userId && recording.user?.supabaseId === userId)) return;
    let ticks = 0;
    let sent = false;
    const timer = window.setInterval(() => {
      if (sent || document.visibilityState !== 'visible' || getConsent() !== 'accepted') return;
      const video = document.querySelector('video');
      const ready = recording.type === 'video'
        ? video && !video.paused && !video.ended && video.readyState >= 2
        : Array.from(document.images).some(img => img.complete && img.naturalWidth > 0 && img.src === recording.fileUrl);
      if (!ready || ++ticks < 5) return;
      sent = true;
      let sessionId = sessionStorage.getItem('snaprec_view_session');
      if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('snaprec_view_session', sessionId); }
      void fetchWithAuth<{ counted: boolean }>(`/recordings/${recording.id}/view`, {
        method: 'POST', body: JSON.stringify({ sessionId }),
      }).then(result => {
        if (result.counted) capture('qualified_view', { content_type: recording.type });
      }).catch(() => { sent = false; });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording?.id, recording?.fileUrl, recording?.isReady, recording?.type, recording?.user?.supabaseId, userId]);
}
