/** The offline upload queue.
 *
 * Pure reducers over an array. The service worker owns persistence
 * (chrome.storage.local) and the alarm; this file owns the rules. Keeping them
 * apart is what makes "closing the window does not stop the upload" testable
 * rather than merely claimed.
 *
 * This is the CLASSIC-SCRIPT copy that importScripts loads — importScripts
 * cannot load an ES module, so background/queue.core.js holds the identical
 * bodies for the tests. __tests__/queue.test.js fails if the two drift. */

const MAX_BACKOFF_MS = 900_000; // 15 minutes

function enqueue(queue, item) {
  if (queue.some((i) => i.id === item.id)) return queue;
  return [...queue, {
    ...item, status: 'pending', attempts: 0, offsetPct: 0, url: null, reason: null,
  }];
}

const patch = (queue, id, fields) =>
  queue.map((i) => (i.id === id ? { ...i, ...fields } : i));

function markUploading(queue, id, pct) {
  return patch(queue, id, { status: 'uploading', offsetPct: pct });
}

function markFailed(queue, id, reason, at) {
  return queue.map((i) => (i.id === id
    ? { ...i, status: 'pending', reason, offsetPct: at ?? i.offsetPct, attempts: i.attempts + 1 }
    : i));
}

function markDone(queue, id, url) {
  return patch(queue, id, { status: 'done', url, reason: null, offsetPct: 100 });
}

function nextPending(queue) {
  return queue
    .filter((i) => i.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
}

function backoffMs(attempts) {
  return Math.min(30_000 * 2 ** attempts, MAX_BACKOFF_MS);
}

/** Completed items are kept so the popup can still show their link. Pending
 * items are never pruned — a queued capture may be the user's only copy of
 * work they have already closed the tab on. */
function prune(queue, nowMs, maxAgeMs) {
  return queue.filter((i) => i.status !== 'done' || nowMs - i.createdAt < maxAgeMs);
}

// Loaded by importScripts into the service worker's global scope.
globalThis.SnapRecQueue = {
  enqueue, markUploading, markFailed, markDone, nextPending, backoffMs, prune,
};
