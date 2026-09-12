# Recording Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A finished recording is written to the user's disk before any other post-recording work runs, and the handoff to the share page completes in constant time regardless of recording length.

**Architecture:** Three changes in sequence. (1) `handleRecordingComplete` opens with a `chrome.downloads` write of the capture and waits for it to land, so the file exists on disk before the preview tab is even created. (2) The 512 KB chunked IPC handoff is deleted and replaced by a same-origin courier: the offscreen document parks the blob in extension-origin IndexedDB, and a hidden extension iframe inside the `/v` tab reads it and `postMessage`s the `Blob` to the page — a by-reference transfer whose cost does not scale with size. (3) The share page gains a tolerant, origin-checked reader that understands both the new and the legacy message shapes.

**Tech Stack:** Chrome MV3 (plain classic scripts, no build step), Vitest + jsdom for both workspaces, React 19 + TypeScript for the web app.

**Spec:** `docs/superpowers/specs/2026-09-13-recording-durability.md`

## Global Constraints

- **The extension has no build step.** `background/*.js` are classic scripts loaded by `importScripts` into one shared global scope. They are not ES modules. Anything new that `importScripts` loads must follow the established twin pattern: pure logic in `<name>.core.js` (ESM, imported only by tests) plus an identical `<name>.js` that ends by assigning to `globalThis`, with a drift test asserting the two have not diverged. See `background/queue.core.js` / `background/queue.js` / `tests/queue.test.js`.
- **`importScripts('config.js')` must stay first** in `background/background.js` — it defines the global `CONFIG` that every other file reads.
- **The web app must keep accepting the legacy handoff shape indefinitely.** Extension updates roll out over days through the Chrome Web Store. Users on v2.0.6 and earlier post `{ type: 'SNAPREC_VIDEO_DATA', fromIDB: true, id }` from the page's own main world. Removing support for that shape breaks every user who has not yet updated. Ship the web change **before** the extension change.
- **Never widen `postMessage` targets.** New code posts to an exact origin (`CONFIG.WEB_BASE_URL`), never `'*'`.
- **No hex literals in web `.tsx` files** — colours come from `var(--sr-*)` tokens. (Project rule; this plan touches no colours, but the constraint stands.)
- **Do not bump versions by hand.** Releases go through `./ship-to-store.sh`.
- Extension tests: `npm test --workspace=apps/extension`. Web tests: `npm test --workspace=apps/web`.

---

### Task 1: Naming and outcome rules for the disk copy

The pure, testable half of the disk save: what the file is called, and how to
read success or failure out of the two different ways `chrome.downloads`
reports it. Task 2 wires this to the actual API.

**Files:**
- Create: `apps/extension/background/recording-file.core.js`
- Create: `apps/extension/background/recording-file.js`
- Test: `apps/extension/tests/recordingFile.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces, on `globalThis.SnapRecFile` for the service worker and as named ESM exports for tests:
  - `recordingFilename(date: Date, mimeType: string) => string`
  - `downloadStarted(downloadId: number|undefined, lastErrorMessage: string|undefined) => { ok: true, downloadId: number } | { ok: false, reason: string }`
  - `downloadSettled(delta: object|null, downloadId: number) => { ok: true } | { ok: false, reason: string } | null`

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/recordingFile.test.js`:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  downloadSettled, downloadStarted, recordingFilename,
} from '../background/recording-file.core.js';

/** The disk copy is the product's only guarantee that a recording survives.
 *
 * These tests exist because both of its failure modes are silent:
 * chrome.downloads reports a refusal by setting lastError and returning an
 * undefined id, and reports a mid-write failure only through an onChanged
 * delta that arrives long after the call returned. Neither surfaces unless
 * you ask, which is how a capture used to vanish with nothing logged. */
describe('disk copy naming', () => {
  it('files the capture under a SnapRec folder so there is somewhere to look', () => {
    const name = recordingFilename(new Date(2026, 8, 13, 14, 5, 9), 'video/webm');
    expect(name.startsWith('SnapRec/')).toBe(true);
  });

  it('zero-pads every field so names sort chronologically', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'video/webm'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.webm');
  });

  it('follows the recorder rather than assuming webm', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), 'video/mp4;codecs=avc1'))
      .toBe('SnapRec/SnapRec-2026-01-02-030405.mp4');
  });

  it('treats an unrecognised mime type as webm, the recorder default', () => {
    expect(recordingFilename(new Date(2026, 0, 2, 3, 4, 5), '')).toMatch(/\.webm$/);
  });
});

describe('reading the start of a download', () => {
  it('accepts a real download id', () => {
    expect(downloadStarted(42, undefined)).toEqual({ ok: true, downloadId: 42 });
  });

  it('reports lastError in preference to anything else', () => {
    expect(downloadStarted(42, 'Download interrupted')).toEqual({
      ok: false, reason: 'Download interrupted',
    });
  });

  it('treats an undefined id as a refusal, not a success', () => {
    expect(downloadStarted(undefined, undefined)).toEqual({
      ok: false, reason: 'download did not start',
    });
  });

  it('does not mistake download id 0 for a missing id', () => {
    expect(downloadStarted(0, undefined)).toEqual({ ok: true, downloadId: 0 });
  });
});

describe('reading the end of a download', () => {
  it('stays silent until the download actually settles', () => {
    expect(downloadSettled({ id: 7, bytesReceived: { current: 1024 } }, 7)).toBeNull();
  });

  it('ignores deltas belonging to some other download', () => {
    expect(downloadSettled({ id: 8, state: { current: 'complete' } }, 7)).toBeNull();
  });

  it('reports completion', () => {
    expect(downloadSettled({ id: 7, state: { current: 'complete' } }, 7)).toEqual({ ok: true });
  });

  it('reports the interruption reason when Chrome gives one', () => {
    expect(downloadSettled(
      { id: 7, state: { current: 'interrupted' }, error: { current: 'DISK_FULL' } }, 7,
    )).toEqual({ ok: false, reason: 'DISK_FULL' });
  });

  it('still reports an interruption that carries no reason', () => {
    expect(downloadSettled({ id: 7, state: { current: 'interrupted' } }, 7)).toEqual({
      ok: false, reason: 'interrupted',
    });
  });

  it('tolerates a null delta', () => {
    expect(downloadSettled(null, 7)).toBeNull();
  });
});

describe('the classic-script copy', () => {
  it('has not drifted from the tested module', () => {
    // Order matters: strip the whole `export { ... };` block BEFORE stripping
    // a leading `export ` keyword, or the first rule eats the keyword and
    // leaves an orphaned brace list behind.
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecFile[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/recording-file.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/recording-file.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/extension -- recordingFile
```

Expected: FAIL — `Failed to resolve import "../background/recording-file.core.js"`.

- [ ] **Step 3: Write the ESM core**

Create `apps/extension/background/recording-file.core.js`:

```js
/** Naming and outcome rules for the disk copy of a capture.
 *
 * The disk copy is the only part of the pipeline that does not depend on a
 * tab, a network, a session or a server, which is why it runs first and why
 * its failures are worth reading carefully. chrome.downloads announces them
 * two different ways — a lastError plus an undefined id at call time, and an
 * onChanged delta minutes later — and neither surfaces on its own.
 *
 * This is the ESM copy, imported only by the tests. background/recording-file.js
 * is the classic-script twin that importScripts loads — tests/recordingFile.test.js
 * fails if the two drift. */

/** A name the user can find, in a folder they can find.
 *
 * The leading `SnapRec/` is not decoration: chrome.downloads treats a slash in
 * the filename as a subfolder of Downloads, so this is what turns "no folder"
 * into a folder. Fields are zero-padded so the directory sorts chronologically
 * in every file manager. */
function recordingFilename(date = new Date(), mimeType = 'video/webm') {
  const ext = /mp4/i.test(mimeType) ? 'mp4' : 'webm';
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

export { recordingFilename, downloadStarted, downloadSettled };
```

- [ ] **Step 4: Write the classic-script twin**

Create `apps/extension/background/recording-file.js` with **byte-identical bodies**, the header paragraph adjusted, and the ESM export replaced by a global assignment:

```js
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
  const ext = /mp4/i.test(mimeType) ? 'mp4' : 'webm';
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
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test --workspace=apps/extension -- recordingFile
```

Expected: PASS, 15 tests. If the drift test fails, the two files differ in something other than comments and the export line — diff them and make the bodies identical.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/background/recording-file.core.js \
        apps/extension/background/recording-file.js \
        apps/extension/tests/recordingFile.test.js
git commit -m "feat(extension): naming and outcome rules for the on-disk copy

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Write every recording to disk before anything else

The safety net. After this task a recording survives a failed handoff, a closed
tab, a dead network, a signed-out user and a server outage.

**Files:**
- Modify: `apps/extension/offscreen/offscreen.js` — add an `offscreen_getBlobUrl` case to the message switch (alongside `offscreen_getBlobInfo`, around line 92)
- Modify: `apps/extension/background/background.js:1-10` — add the `importScripts` line
- Modify: `apps/extension/background/background.js` — add `saveRecordingToDisk()`, call it from `handleRecordingComplete()` (around line 1062)

**Interfaces:**
- Consumes: `SnapRecFile.recordingFilename`, `SnapRecFile.downloadStarted`, `SnapRecFile.downloadSettled` from Task 1.
- Produces: `saveRecordingToDisk() => Promise<{ filename: string, bytes: number, mimeType: string } | null>` — Task 6 reports this to the popup. Returns `null` when no file reached disk.

- [ ] **Step 1: Expose a blob URL from the offscreen document**

In `apps/extension/offscreen/offscreen.js`, add this case immediately after the
`offscreen_getBlobInfo` case:

```js
        /* A handle to the capture that chrome.downloads can read.
         *
         * The URL belongs to THIS document, so the document must outlive the
         * write — see saveRecordingToDisk, which waits for the download to
         * settle rather than merely to start. Not revoked here for the same
         * reason; closing the document releases it. */
        case 'offscreen_getBlobUrl':
            if (!currentRecordingBlob) {
                sendResponse({ success: false, error: 'No recording available' });
            } else {
                sendResponse({
                    success: true,
                    url: URL.createObjectURL(currentRecordingBlob),
                    size: currentRecordingBlob.size,
                    mimeType: currentRecordingBlob.type || 'video/webm',
                });
            }
            return false;
```

- [ ] **Step 2: Load the naming rules into the service worker**

In `apps/extension/background/background.js`, add after the `queue.js` line:

```js
importScripts('recording-file.js');
```

- [ ] **Step 3: Add the disk save**

In `apps/extension/background/background.js`, insert this function immediately
above `async function handleRecordingComplete()`:

```js
/** Ten minutes. A local disk write of a multi-gigabyte capture is seconds, so
 * this is not a deadline — it is the guard against waiting forever on a
 * download that will never report, which would leave the preview tab unopened. */
const DISK_SAVE_TIMEOUT_MS = 600_000;

/** Writes the capture to disk before anything else is attempted.
 *
 * This is the promise the product used to break. The recording existed as one
 * in-memory Blob in the offscreen document, and the chunked handoff that was
 * meant to rescue it could not finish inside its own kill timer for anything
 * longer than a few minutes — so the timer fired, the document closed, and the
 * only copy went with it. Disk first, then everything else: a failed upload, a
 * closed tab or a dead network now costs a link, not the recording.
 *
 * Awaits settling rather than starting, because the blob: URL belongs to the
 * offscreen document and Chrome is still reading through it. finalizeCleanup
 * must not run until this returns. */
async function saveRecordingToDisk() {
    const info = await chrome.runtime
        .sendMessage({ action: 'offscreen_getBlobUrl' })
        .catch((e) => ({ success: false, error: e.message }));

    const fail = (reason) => {
        console.error('[SnapRec] Could not save recording to disk:', reason);
        Analytics.track('recording_download_failed', {
            surface: 'auto_save',
            error_reason: String(reason),
        });
        chrome.notifications.create('snaprec-autosave-failed', {
            type: 'basic',
            iconUrl: '../icons/icon128.png',
            title: 'Could not save your recording',
            message: 'SnapRec could not write the file to your Downloads folder. '
                + 'Use the preview tab to download it before closing that tab.',
            priority: 2,
        });
        return null;
    };

    if (!info?.success) return fail(info?.error ?? 'no blob');

    const filename = SnapRecFile.recordingFilename(new Date(), info.mimeType);

    const started = await new Promise((resolve) => {
        chrome.downloads.download({ url: info.url, filename, saveAs: false }, (downloadId) => {
            resolve(SnapRecFile.downloadStarted(downloadId, chrome.runtime.lastError?.message));
        });
    });
    if (!started.ok) return fail(started.reason);

    const settled = await new Promise((resolve) => {
        const timer = setTimeout(() => {
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve({ ok: false, reason: 'timeout' });
        }, DISK_SAVE_TIMEOUT_MS);

        const onChanged = (delta) => {
            const outcome = SnapRecFile.downloadSettled(delta, started.downloadId);
            if (!outcome) return;
            clearTimeout(timer);
            chrome.downloads.onChanged.removeListener(onChanged);
            resolve(outcome);
        };
        chrome.downloads.onChanged.addListener(onChanged);
    });
    if (!settled.ok) return fail(settled.reason);

    console.log('[SnapRec] Recording saved to disk:', filename, info.size, 'bytes');
    Analytics.track('recording_download_completed', {
        surface: 'auto_save',
        file_size_mb: Math.round((info.size / (1024 * 1024)) * 100) / 100,
    });
    return { filename, bytes: info.size, mimeType: info.mimeType };
}
```

- [ ] **Step 4: Call it before anything that can lose the capture**

> **Amended during execution.** This step originally placed the call before
> `const recordingId = crypto.randomUUID();`, which put a multi-second disk
> write ahead of `chrome.tabs.create` and left the user staring at nothing
> after pressing stop. Opening the tab does not touch the blob, so it goes
> first; the write still completes before `finalizeCleanup()`, which is the
> only thing that can destroy the capture. The guarantee is unchanged.

In `handleRecordingComplete()`, immediately after
`const tab = await chrome.tabs.create({ url: shareUrl });`, insert:

```js
        /* Disk before anything that can cost us the capture.
         *
         * Opening the tab above is free — it does not touch the blob — so it
         * goes first and the user gets an instant response. Everything BELOW
         * this line can lose the recording: finalizeCleanup closes the
         * offscreen document, and the blob: URL Chrome is writing from belongs
         * to it. So the write completes here, before any of that runs.
         *
         * This is the guarantee the product used to break. A failed upload, a
         * closed tab or a dead network now costs a link, not the recording. */
        const savedFile = await saveRecordingToDisk();
```

- [ ] **Step 5: Verify in Chrome**

The service-worker glue is not unit-testable without mocking most of the
`chrome` namespace; this codebase's convention is to test the pure core (Task 1)
and verify the wiring by hand, as `background/queue.js` does. Run through this:

1. In `apps/extension/background/config.js`, leave the production URLs in place.
2. Load `apps/extension` unpacked at `chrome://extensions`, with the service
   worker inspector open.
3. Record for **two minutes**, then stop.
4. Confirm `~/Downloads/SnapRec/SnapRec-<timestamp>.webm` exists and plays.
5. Confirm the worker logged `Recording saved to disk:` with a plausible size.
6. Repeat offline (DevTools → Network → Offline) and signed out. The file must
   still appear.

- [ ] **Step 6: Run the full extension suite**

```bash
npm test --workspace=apps/extension
```

Expected: PASS. Nothing here changes tested behaviour, so a failure means a
syntax error in `background.js` — check the service worker inspector.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/background/background.js apps/extension/offscreen/offscreen.js
git commit -m "fix(extension): write every recording to disk before anything else

The recording existed as one in-memory Blob in the offscreen document, and
the chunked handoff meant to rescue it could not finish inside its own
60s kill timer for anything over a few minutes. The timer fired, the
document closed, and the only copy went with it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: A tolerant, origin-checked handoff reader on the share page

Ships **before** the extension change, so the web app understands the new
message shape by the time any extension sends one, and keeps understanding the
old shape for users who have not updated.

**Files:**
- Create: `apps/web/src/lib/handoffMessage.ts`
- Test: `apps/web/src/__tests__/handoffMessage.test.ts`
- Modify: `apps/web/src/pages/ShareView.tsx:397-455` — the `handleMessage` body

**Interfaces:**
- Consumes: nothing.
- Produces: `readHandoffMessage(origin: string, data: unknown, selfOrigin: string) => HandoffPayload | null`, where `HandoffPayload` is `{ kind: 'blob'; blob: Blob; id?: string; metadataStr?: string }` | `{ kind: 'idb'; id?: string }` | `{ kind: 'dataUrl'; dataUrl: string; id?: string }`. Task 4's extension iframe produces the `blob` kind, and its `metadataStr` is the JSON the video editor later reads back out of `sessionStorage` (`VideoEditorContext.tsx:391`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/handoffMessage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readHandoffMessage } from '../lib/handoffMessage';

/** The gate every capture passes through on its way into the share view.
 *
 * Two things are being defended at once and they pull in opposite directions.
 * Extensions update over days, so the legacy shape — posted from the page's
 * own main world by an injected script — has to keep working or every user
 * who has not updated loses their recording. But the handler used to accept
 * SNAPREC_VIDEO_DATA from any origin at all, which let any cross-origin frame
 * on the page put a video in front of the user. Accept both shapes; accept
 * neither from a stranger. */

const SELF = 'https://www.snaprecorder.org';
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

describe('readHandoffMessage', () => {
  it('accepts a Blob from the extension iframe', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1' }, SELF))
      .toEqual({ kind: 'blob', blob, id: 'r1', metadataStr: undefined });
  });

  it('carries click metadata through to the video editor', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, id: 'r1', metadataStr: '[{"t":1,"x":2}]',
    }, SELF);
    expect(got).toEqual({ kind: 'blob', blob, id: 'r1', metadataStr: '[{"t":1,"x":2}]' });
  });

  it('still accepts a capture whose metadata is not a string', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, metadataStr: { nope: true },
    }, SELF);
    expect(got?.kind).toBe('blob');
    expect((got as { metadataStr?: string }).metadataStr).toBeUndefined();
  });

  it('accepts the legacy same-origin IDB signal from older extensions', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_VIDEO_DATA', fromIDB: true, id: 'r1' }, SELF))
      .toEqual({ kind: 'idb', id: 'r1' });
  });

  it('accepts the legacy data URL shape', () => {
    expect(readHandoffMessage(SELF, { type: 'SNAPREC_VIDEO_DATA', dataUrl: 'data:video/webm;base64,AA' }, SELF))
      .toEqual({ kind: 'dataUrl', dataUrl: 'data:video/webm;base64,AA', id: undefined });
  });

  it('rejects a capture from a cross-origin frame', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage('https://evil.example', { type: 'SNAPREC_VIDEO_DATA', blob }, SELF))
      .toBeNull();
  });

  it('rejects a look-alike origin that merely starts with the real one', () => {
    expect(readHandoffMessage(
      'https://www.snaprecorder.org.evil.example',
      { type: 'SNAPREC_VIDEO_DATA', fromIDB: true },
      SELF,
    )).toBeNull();
  });

  it('ignores messages that are not ours', () => {
    expect(readHandoffMessage(EXT, { type: 'SOMETHING_ELSE', fromIDB: true }, SELF)).toBeNull();
  });

  it('ignores a correctly-typed message carrying no capture', () => {
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', id: 'r1' }, SELF)).toBeNull();
  });

  it('prefers the Blob when a message somehow carries both', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    const got = readHandoffMessage(EXT, {
      type: 'SNAPREC_VIDEO_DATA', blob, fromIDB: true, id: 'r1',
    }, SELF);
    expect(got?.kind).toBe('blob');
  });

  it('survives junk', () => {
    expect(readHandoffMessage(EXT, null, SELF)).toBeNull();
    expect(readHandoffMessage(EXT, 'string', SELF)).toBeNull();
    expect(readHandoffMessage(EXT, 42, SELF)).toBeNull();
  });

  it('drops a non-string id rather than passing it on', () => {
    const blob = new Blob(['x'], { type: 'video/webm' });
    expect(readHandoffMessage(EXT, { type: 'SNAPREC_VIDEO_DATA', blob, id: 99 }, SELF))
      .toEqual({ kind: 'blob', blob, id: undefined, metadataStr: undefined });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/web -- handoffMessage
```

Expected: FAIL — `Failed to resolve import "../lib/handoffMessage"`.

- [ ] **Step 3: Write the reader**

Create `apps/web/src/lib/handoffMessage.ts`:

```ts
/** The gate every capture passes through on its way into the share view.
 *
 * The share view used to accept a SNAPREC_VIDEO_DATA message from any origin,
 * so any cross-origin frame on the page could hand the user a video. It now
 * accepts two senders and no others: the extension's own handoff iframe, which
 * is a chrome-extension:// origin, and the page itself.
 *
 * The same-origin allowance exists only for extensions at v2.0.6 and earlier,
 * which post from the page's main world through an injected script. Drop it
 * once Chrome Web Store telemetry shows that version is no longer in use — it
 * is the weaker half of this check. */

export type HandoffPayload =
  | { kind: 'blob'; blob: Blob; id?: string; metadataStr?: string }
  | { kind: 'idb'; id?: string }
  | { kind: 'dataUrl'; dataUrl: string; id?: string };

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export function readHandoffMessage(
    origin: string,
    data: unknown,
    selfOrigin: string,
): HandoffPayload | null {
    if (origin !== selfOrigin && !EXTENSION_ORIGIN.test(origin)) return null;
    if (typeof data !== 'object' || data === null) return null;

    const msg = data as Record<string, unknown>;
    if (msg.type !== 'SNAPREC_VIDEO_DATA') return null;

    const id = typeof msg.id === 'string' ? msg.id : undefined;

    // Order is deliberate: a Blob is the whole capture in hand, so it wins over
    // a signal that merely says where to go looking for one.
    if (msg.blob instanceof Blob) {
        // Carried through rather than parsed here: the video editor reads it
        // back out of sessionStorage (VideoEditorContext.tsx:391), and a
        // capture must not be refused because its click metadata is malformed.
        const metadataStr = typeof msg.metadataStr === 'string' ? msg.metadataStr : undefined;
        return { kind: 'blob', blob: msg.blob, id, metadataStr };
    }
    if (msg.fromIDB === true) return { kind: 'idb', id };
    if (typeof msg.dataUrl === 'string' && msg.dataUrl) {
        return { kind: 'dataUrl', dataUrl: msg.dataUrl, id };
    }
    return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/web -- handoffMessage
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Use it in ShareView**

In `apps/web/src/pages/ShareView.tsx`, add to the imports:

```ts
import { readHandoffMessage } from '../lib/handoffMessage';
```

Then replace the body of `handleMessage` (the `async (event: MessageEvent) => { ... }`
passed to `window.addEventListener('message', ...)`) with:

```ts
        const handleMessage = async (event: MessageEvent) => {
            const payload = readHandoffMessage(event.origin, event.data, window.location.origin);
            if (!payload) return;
            console.log('Received video data from extension with id:', payload.id);

            if (payload.kind === 'blob') {
                // A Blob crosses postMessage by reference, so this costs the
                // same for a one-hour capture as for a ten-second one. It is
                // also copied into this origin's IndexedDB, because the frame
                // that delivered it is gone after a refresh and the share page
                // has to survive one.
                const blobUrl = URL.createObjectURL(payload.blob);
                console.log('Video blob received by reference, size:', payload.blob.size);
                videoBlobSetByMessage.current = true;
                setLocalVideoBlob(blobUrl);

                // The video editor reads this back out of sessionStorage to
                // rebuild auto-zoom and click markers; dropping it here would
                // silently cost every new recording its zoom track.
                if (payload.metadataStr) {
                    try {
                        setLocalMetadata(JSON.parse(payload.metadataStr));
                        sessionStorage.setItem('snaprec_local_metadata', payload.metadataStr);
                    } catch {
                        console.warn('Could not store capture metadata');
                    }
                }

                void persistBlobToIDB(payload.blob, payload.id ?? null, payload.metadataStr ?? null);
            } else if (payload.kind === 'idb') {
                console.log('Loading video blob from IndexedDB (legacy extension)...');
                const { blob, metadata } = await loadBlobAndMetadataFromIDB();

                if (metadata) {
                    setLocalMetadata(metadata);
                    try {
                        sessionStorage.setItem('snaprec_local_metadata', JSON.stringify(metadata));
                    } catch { /* quota */ }
                }

                if (blob) {
                    const blobUrl = URL.createObjectURL(blob);
                    console.log('Video blob loaded from IDB, size:', blob.size, 'type:', blob.type);
                    videoBlobSetByMessage.current = true;
                    setLocalVideoBlob(blobUrl);
                } else {
                    console.warn('No blob found in IndexedDB, trying the legacy string key');
                    const { blob: legacyBlob } = await loadFromIndexedDB();
                    if (legacyBlob) {
                        setLocalVideoBlob(legacyBlob.startsWith('data:')
                            ? await convertBase64ToBlobUrl(legacyBlob)
                            : legacyBlob);
                    }
                }
            } else {
                const { dataUrl } = payload;
                setLocalVideoBlob(dataUrl.startsWith('data:')
                    ? await convertBase64ToBlobUrl(dataUrl)
                    : dataUrl);

                // Only try sessionStorage for small data (< 2MB)
                if (dataUrl.length < 2 * 1024 * 1024) {
                    try {
                        sessionStorage.setItem('snaprec_local_video_blob', dataUrl);
                    } catch {
                        console.warn('QuotaExceededError: Cannot save video to sessionStorage');
                    }
                }
            }

            if (payload.id) {
                setLocalId(payload.id);
                try {
                    sessionStorage.setItem('snaprec_local_video_id', payload.id);
                } catch {
                    console.warn('QuotaExceededError: Cannot save video ID to sessionStorage');
                }
            }
        };
```

- [ ] **Step 6: Add the IDB persist helper**

Inside the same `useEffect`, immediately after the `loadBlobAndMetadataFromIDB`
definition, add:

```ts
        /** Keeps a refresh from losing the capture.
         *
         * The frame that delivered the Blob belongs to the extension and is
         * gone the moment this page reloads, so the page keeps its own copy.
         * Writing a Blob to IndexedDB does not pull it through the JS heap —
         * the browser moves it between its own stores — so size is not a
         * concern here the way it was for the base64 path this replaced. */
        const persistBlobToIDB = (
            blob: Blob, id: string | null, metadataStr: string | null,
        ): Promise<void> =>
            new Promise((resolve) => {
                try {
                    const request = indexedDB.open('SnapRecDB', 2);
                    request.onupgradeneeded = (e: any) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('recordings')) {
                            db.createObjectStore('recordings');
                        }
                    };
                    request.onsuccess = (e: any) => {
                        const db = e.target.result;
                        const tx = db.transaction(['recordings'], 'readwrite');
                        const store = tx.objectStore('recordings');
                        store.clear();
                        store.put(blob, 'latest_video_blob');
                        if (id) store.put(id, 'latest_id');
                        if (metadataStr) store.put(metadataStr, 'latest_metadata');
                        store.put(Date.now(), 'latest_video_timestamp');
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => resolve();
                    };
                    request.onerror = () => resolve();
                } catch {
                    resolve();
                }
            });
```

- [ ] **Step 7: Run the full web suite and typecheck**

```bash
npm test --workspace=apps/web
npm run build --workspace=apps/web
```

Expected: both PASS. The build runs `tsc -b`, which is what catches a mistyped
`payload.kind` branch.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/handoffMessage.ts \
        apps/web/src/__tests__/handoffMessage.test.ts \
        apps/web/src/pages/ShareView.tsx
git commit -m "feat(web): accept a by-reference Blob handoff, and check its origin

Also stops accepting SNAPREC_VIDEO_DATA from arbitrary origins.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Deploy the web app before starting Task 4**

Task 4 makes the extension send the new shape. This must already be live at
`https://www.snaprecorder.org` first. Confirm by opening `/v` in production and
checking that `handoffMessage` appears in the served bundle.

---

### Task 4: Replace the chunked handoff with a same-origin courier

Deletes the 60-second timer, the 512 KB chunking, and the unreachable retry.

**Files:**
- Create: `apps/extension/handoff/handoff.html`
- Create: `apps/extension/handoff/handoff.js`
- Modify: `apps/extension/manifest.json` — `web_accessible_resources[0].resources`
- Modify: `apps/extension/offscreen/offscreen.js` — add `offscreen_persistForHandoff`
- Modify: `apps/extension/background/background.js:1078-1235` — replace the chunked injection block

**Interfaces:**
- Consumes: `readHandoffMessage` on the web side (Task 3) accepts `{ type: 'SNAPREC_VIDEO_DATA', blob: Blob, id: string }`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Park the capture in extension-origin IndexedDB**

In `apps/extension/offscreen/offscreen.js`, replace the whole
`storeRecordingBlobToIDB` function (it is currently dead code — nothing calls
it) with a version that stores everything the share page needs:

```js
/** Parks the capture in extension-origin IndexedDB.
 *
 * This is what unhooks the capture from this document's lifetime. Once the
 * blob is here, the offscreen document can close immediately and Chrome can
 * reap it — which it wants to do the moment the media tracks stop — without
 * taking the recording with it. handoff/handoff.js, same origin, reads it back. */
async function persistForHandoff(id, metadataStr) {
    if (!currentRecordingBlob) {
        throw new Error('No recording blob available');
    }
    const blob = currentRecordingBlob;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnapRecDB', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings');
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            store.clear();
            store.put(blob, 'latest_video_blob');
            store.put(id, 'latest_id');
            store.put(metadataStr, 'latest_metadata');
            store.put(Date.now(), 'latest_video_timestamp');

            transaction.oncomplete = () => {
                console.log('[Offscreen] Capture parked for handoff, size:', blob.size);
                resolve({ size: blob.size, type: blob.type });
            };
            transaction.onerror = () => reject(new Error('Failed to park capture for handoff'));
        };

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
}
```

Then replace the `offscreen_storeRecordingBlob` case in the message switch with:

```js
        case 'offscreen_persistForHandoff':
            persistForHandoff(message.id, message.metadataStr)
                .then(result => sendResponse({ success: true, size: result.size, type: result.type }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
```

- [ ] **Step 2: Write the courier page**

Create `apps/extension/handoff/handoff.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>SnapRec handoff</title>
<script src="../background/config.js"></script>
<script src="handoff.js"></script>
```

Create `apps/extension/handoff/handoff.js`:

```js
/** Carries a finished capture across the origin boundary, by reference.
 *
 * The share page is https://www.snaprecorder.org and the capture is parked in
 * chrome-extension:// IndexedDB, which that page cannot read. This document is
 * same-origin with the offscreen document that parked it and is embedded as a
 * hidden frame in the share page, so it can read the blob and hand it upward.
 *
 * A Blob crosses postMessage BY REFERENCE — the bytes are not copied. That is
 * the entire point. The previous design marshalled the capture through
 * chrome.runtime and chrome.scripting in 512 KB chunks, each one an array of
 * 524,288 boxed numbers serialised twice, which took minutes for an hour-long
 * recording and was killed by a 60-second timer long before it finished.
 *
 * Posts to an exact origin, never '*': this frame is embedded in a page and
 * the capture is the user's private screen recording. */

const params = new URLSearchParams(location.search);
const id = params.get('id') || '';

function readParked() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SnapRecDB', 2);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                db.createObjectStore('recordings');
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('recordings')) {
                reject(new Error('no store'));
                return;
            }
            const store = db.transaction(['recordings'], 'readonly').objectStore('recordings');
            const blobReq = store.get('latest_video_blob');
            blobReq.onsuccess = () => {
                const metaReq = store.get('latest_metadata');
                metaReq.onsuccess = () => resolve({
                    blob: blobReq.result instanceof Blob ? blobReq.result : null,
                    metadataStr: metaReq.result ?? null,
                });
                metaReq.onerror = () => resolve({ blob: blobReq.result ?? null, metadataStr: null });
            };
            blobReq.onerror = () => reject(new Error('read failed'));
        };

        request.onerror = () => reject(new Error('open failed'));
    });
}

(async () => {
    try {
        const { blob, metadataStr } = await readParked();
        if (!blob) throw new Error('nothing parked');
        parent.postMessage(
            { type: 'SNAPREC_VIDEO_DATA', blob, id, metadataStr },
            CONFIG.WEB_BASE_URL,
        );
        console.log('[Handoff] Delivered capture, size:', blob.size);
    } catch (error) {
        console.error('[Handoff] Could not deliver capture:', error.message);
    }
})();
```

- [ ] **Step 3: Make the courier page reachable**

In `apps/extension/manifest.json`, add two entries to the `resources` array of
the first `web_accessible_resources` block, after `"offscreen/resolution.js"`:

```json
    "handoff/handoff.html",
    "handoff/handoff.js",
```

- [ ] **Step 4: Replace the chunked injection**

In `apps/extension/background/background.js`, inside `handleRecordingComplete()`,
delete everything from `let injectionSucceeded = false;` through
`chrome.tabs.onUpdated.addListener(listener);` — that is the whole
`safetyTimeout` / `CHUNK_SIZE` / `attemptChunkedInjection` / `listener` /
`MAX_RETRIES` block — and replace it with:

```js
        /* Park the capture, then close the recorder. Once the blob is in
         * extension-origin IndexedDB it no longer depends on the offscreen
         * document staying alive, which removes the race this code used to
         * lose: Chrome reaps an offscreen document once its media tracks stop,
         * and the old chunked transfer took minutes. */
        const parked = await chrome.runtime.sendMessage({
            action: 'offscreen_persistForHandoff',
            id: recordingId,
            metadataStr: JSON.stringify(recordingMetadata),
        }).catch((e) => ({ success: false, error: e.message }));

        if (!parked?.success) {
            console.error('[SnapRec] Could not park capture for handoff:', parked?.error);
        }
        await finalizeCleanup();

        /* The courier is same-origin with the parked blob and can hand it to
         * the page by reference. Injected on tab load rather than immediately:
         * an about:blank tab has no document to append to yet. */
        const frameUrl = chrome.runtime.getURL(
            `handoff/handoff.html?id=${encodeURIComponent(recordingId)}`);

        const listener = async (tabId, info) => {
            if (tabId !== tab.id || info.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(listener);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (src) => {
                        const frame = document.createElement('iframe');
                        frame.src = src;
                        frame.setAttribute('aria-hidden', 'true');
                        frame.style.cssText =
                            'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
                        document.documentElement.appendChild(frame);
                    },
                    args: [frameUrl],
                });
                console.log('[SnapRec] Handoff frame injected');
            } catch (err) {
                console.error('[SnapRec] Could not inject handoff frame:', err.message);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
```

- [ ] **Step 5: Verify in Chrome**

1. Reload the unpacked extension.
2. Record for **two minutes**. Confirm the `/v` tab plays it, and that the
   service worker logs `Handoff frame injected` with no chunk logs.
3. Open the `/v` tab's console; confirm `Video blob received by reference,
   size: …` and **no** `Starting chunked injection`.
4. **Refresh the `/v` tab.** The video must still play — this exercises the
   Task 3 IDB copy.
5. Record for **65 minutes**. Confirm the file lands in `~/Downloads/SnapRec/`
   and the `/v` tab plays it. Measure stop→playable; it should be within a few
   seconds of the two-minute case. This is the acceptance test for the whole plan.
6. Confirm `~/Downloads/SnapRec/` holds both recordings.

- [ ] **Step 6: Run the full extension suite**

```bash
npm test --workspace=apps/extension
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/handoff/ apps/extension/manifest.json \
        apps/extension/offscreen/offscreen.js apps/extension/background/background.js
git commit -m "fix(extension): hand the capture over by reference, not in 512KB chunks

The old path marshalled the blob through chrome.runtime and
chrome.scripting as arrays of boxed numbers, serialised twice per chunk.
An hour-long recording needed ~2150 round trips against a 60s kill timer
it could never beat. A same-origin frame now passes the Blob itself.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: A TTL that outlives a recording session

**Files:**
- Modify: `apps/web/src/pages/ShareView.tsx:118-121`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Widen the window**

In `apps/web/src/pages/ShareView.tsx`, replace:

```ts
                    // TTL check: expire data older than 1 hour
                    const VIDEO_TTL_MS = 60 * 60 * 1000; // 1 hour
```

with:

```ts
                    /* TTL check. One hour was shorter than the sessions this
                     * is meant to protect: a user who recorded for an hour and
                     * came back to the tab found store.clear() had already run
                     * and their recording gone. Twenty-four hours, and the disk
                     * copy under Downloads/SnapRec is the real safety net now. */
                    const VIDEO_TTL_MS = 24 * 60 * 60 * 1000;
```

- [ ] **Step 2: Run the web suite and build**

```bash
npm test --workspace=apps/web && npm run build --workspace=apps/web
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ShareView.tsx
git commit -m "fix(web): stop expiring the local capture after an hour

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Tell the user where the file went

The popup already has a completion view (`popup/state.js:214`, `popup/render.js:484`).
It has never been reachable, because `captureFinished` has no sender.

**Files:**
- Modify: `apps/extension/background/background.js` — end of `handleRecordingComplete()`
- Modify: `apps/extension/popup/render.js:484-500` — `viewComplete`
- Test: `apps/extension/tests/render.test.js` — add one case

**Interfaces:**
- Consumes: `saveRecordingToDisk()`'s return value from Task 2, in scope as `savedFile`.
- Produces: a `captureFinished` message carrying `{ capture: { id: string, bytes: number, mimeType: string, filename: string | null } }`. `popup/popup.js:202` already dispatches it; `popup/state.js:214` already handles it.

- [ ] **Step 1: Write the failing test**

In `apps/extension/tests/render.test.js`, add inside the existing top-level
`describe`:

```js
describe('completion view (durability)', () => {
  const finished = (filename) => ({
    ...initialState(),
    view: 'complete',
    capture: { id: 'r1', bytes: 1024, mimeType: 'video/webm', filename },
  });

  it('names the file it saved, so the view answers "where did it go"', () => {
    const root = mount(finished('SnapRec/SnapRec-2026-09-13-140509.webm'));
    expect(root.textContent).toContain('SnapRec-2026-09-13-140509.webm');
  });

  it('shows the bare filename, not the folder-prefixed download path', () => {
    const root = mount(finished('SnapRec/SnapRec-2026-09-13-140509.webm'));
    expect(root.textContent).not.toContain('SnapRec/SnapRec-2026');
  });

  it('says nothing about a file when none reached disk', () => {
    expect(mount(finished(null)).textContent).not.toContain('Saved to');
  });
});
```

`mount`, `initialState` and `render` are already imported at the top of
`tests/render.test.js` — add this as a new top-level `describe`, a sibling of
`describe('record view (A1)', ...)`.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=apps/extension -- render
```

Expected: FAIL — the filename does not appear in the output.

- [ ] **Step 3: Show the filename**

In `apps/extension/popup/render.js`, in `viewComplete`, insert immediately after
the `${spine(d)}` line:

```js
    ${state.capture?.filename ? `
      <p class="sr-footnote sr-completion-file">
        Saved to <strong>${state.capture.filename.replace(/^.*\//, '')}</strong>
        in your Downloads folder
      </p>` : ''}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=apps/extension -- render
```

Expected: PASS.

- [ ] **Step 5: Send the message**

In `apps/extension/background/background.js`, at the end of the `try` block in
`handleRecordingComplete()` — after `chrome.tabs.onUpdated.addListener(listener);`
— add:

```js
        /* The popup's completion view has existed since the plate redesign and
         * has never once been reachable: nothing sent captureFinished. This is
         * the sender. Best-effort — the popup is usually closed, which is fine. */
        notifyPopup({
            action: 'captureFinished',
            capture: {
                id: recordingId,
                bytes: savedFile?.bytes ?? 0,
                mimeType: savedFile?.mimeType ?? 'video/webm',
                filename: savedFile?.filename ?? null,
            },
        });
```

- [ ] **Step 6: Verify in Chrome**

1. Reload the unpacked extension.
2. Start a recording, then **keep the popup open** and stop from the in-page bar.
3. The popup must move to "Recording finished" and name the saved file.

- [ ] **Step 7: Run the full extension suite**

```bash
npm test --workspace=apps/extension
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/extension/background/background.js apps/extension/popup/render.js \
        apps/extension/tests/render.test.js
git commit -m "feat(extension): tell the user where the recording was saved

The popup's completion view has existed since the plate redesign and was
never reachable — captureFinished had no sender.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Release

- [ ] Confirm the web app is deployed (Task 3, Step 9) **before** the extension ships.
- [ ] `./ship-to-store.sh` from `apps/extension` — do not hand-edit versions.
- [ ] After the new version is live on the Chrome Web Store, bump
      `apps/web/public/version.json` to match and deploy the web app. The
      service worker polls it every 30 minutes to nag users to update, and it
      currently lags the extension.

## Out of scope — needs its own plan

The popup's upload and library flow is still dead and is a separate subsystem:

- `queueCapture()` (`background.js:1414`) has no callers, so the offline upload
  queue never runs and `uploadQueued` / `uploadSaved` are never sent.
- `uploadCapture` and `cancelUpload`, sent by the popup at `popup/popup.js:124-131`,
  have no receiver in `background/`.
- `data-action="save-library"` and `data-action="annotate"` (`render.js:495-496`)
  have no handlers in `popup.js`.

That work is what would make the recording appear in `/library` without the user
visiting `/v` and clicking Upload. It is worth doing — but it is a product flow,
not a data-loss fix, and it should not gate this plan.
