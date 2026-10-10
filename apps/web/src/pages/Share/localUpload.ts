/** The POST /recordings body for "upload the capture on this device".
 *
 * It deliberately carries no id. The capture's id is the one the extension
 * already registered as a guest row while it streamed the upload, and this
 * request used to reuse it — which only worked because the server upserted,
 * silently taking the guest row over and pointing it at a second copy of the
 * file. The server is insert-only now and answers that with 409. A fresh id
 * gives the signed-in user their own row; the page navigates to whatever id
 * comes back, and the unclaimed guest row expires on its own. */
export interface LocalUploadMeta {
  durationSec?: number;
  widthPx?: number;
  heightPx?: number;
}

export function localUploadCreateInput(
  { fileUrl, userId, meta, now = new Date() }:
  { fileUrl: string; userId?: string; meta: LocalUploadMeta; now?: Date },
) {
  return {
    title: `Video Recording ${now.toLocaleString()}`,
    fileUrl,
    type: 'video' as const,
    durationSec: meta.durationSec,
    widthPx: meta.widthPx,
    heightPx: meta.heightPx,
    // Must name the signed-in user or nobody: the server refuses a userId
    // that does not match the token.
    userId,
    guestId: undefined,
  };
}
