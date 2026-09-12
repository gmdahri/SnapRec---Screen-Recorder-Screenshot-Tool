/** Naming and outcome rules for the disk copy of a capture.
 *
 * The disk copy is the only part of the pipeline that does not depend on a
 * tab, a network, a session or a server, which is why it runs first and why
 * its failures are worth reading carefully. chrome.downloads announces them
 * two different ways — a lastError plus an undefined id at call time, and an
 * onChanged delta minutes later — and neither surfaces on its own.
 *
 * This is the CLASSIC-SCRIPT copy that importScripts loads — importScripts
 * cannot load an ES module, so background/recording-file.core.js holds the
 * identical bodies for the tests. tests/recordingFile.test.js fails if the
 * two drift. */

/** A name the user can find, in a folder they can find.
 *
 * The leading `SnapRec/` is not decoration: chrome.downloads treats a slash in
 * the filename as a subfolder of Downloads, so this is what turns "no folder"
 * into a folder. Fields are zero-padded so the directory sorts chronologically
 * in every file manager. */
function recordingFilename(date = new Date(), mimeType = 'video/webm') {
  // Screenshots share this naming, so the table covers images too. Anything
  // unrecognised falls back to webm, which is what the recorder produces.
  const ext = /webp/i.test(mimeType) ? 'webp'
    : /png/i.test(mimeType) ? 'png'
    : /jpe?g/i.test(mimeType) ? 'jpg'
    : /mp4/i.test(mimeType) ? 'mp4'
    : 'webm';
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
    + `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `SnapRec/SnapRec-${stamp}.${ext}`;
}

/** Did the download begin?
 *
 * Compared against null rather than falsiness: download id 0 is a real id, and
 * treating it as missing would report a started download as a refusal. */
function downloadStarted(downloadId, lastErrorMessage) {
  if (lastErrorMessage) return { ok: false, reason: lastErrorMessage };
  if (downloadId === undefined || downloadId === null) {
    return { ok: false, reason: 'download did not start' };
  }
  return { ok: true, downloadId };
}

/** Did it finish? null means "still going" — most deltas are progress.
 *
 * The id check matters: onChanged is a global listener and fires for every
 * download in the browser, including ones the user started themselves. */
function downloadSettled(delta, downloadId) {
  if (!delta || delta.id !== downloadId) return null;
  const state = delta.state?.current;
  if (state === 'complete') return { ok: true };
  if (state === 'interrupted') {
    return { ok: false, reason: delta.error?.current ?? 'interrupted' };
  }
  return null;
}

// Loaded by importScripts into the service worker's global scope.
globalThis.SnapRecFile = { recordingFilename, downloadStarted, downloadSettled };
