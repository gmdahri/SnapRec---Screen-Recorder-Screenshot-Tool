# P2 Extension, Capture Completion & Offline Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the extension popup as the nine-state machine the prototype specifies (A1–A9), add the capture-completion surface that today does not exist (B1–B6), and make an offline recording queue and drain instead of failing.

**Architecture:** The popup stays plain JS — no build step, per `CLAUDE.md`. But it stops being a pile of `id`-addressed panels and becomes a state machine: one `render(state)` function driven by a single `POPUP_STATE` object, with the design system's rules ported to `popup.css` as `--sr-*` custom properties rather than imported as React. The completion surface (B1–B6) is a **new popup view**, not a web page — the capture must be actionable before any network call succeeds. Offline queueing moves into the service worker, backed by `chrome.storage.local`, so closing the popup or the tab cannot lose a capture.

**Tech Stack:** Manifest V3 plain JS (classic scripts, `importScripts` load order), `chrome.storage.local`, `chrome.alarms` for queue drain, Vitest + jsdom for popup logic, the P1 token values transcribed into `apps/extension/styles/design-system.css`.

## Global Constraints

Inherited verbatim from `2026-08-08-plate-redesign-roadmap.md` § "Global constraints". Every task's requirements implicitly include that section.

Additional, P2-specific:

- **No bundler, no framework, no npm import in the extension.** `background/*.js` are classic scripts sharing one global scope, loaded by `importScripts` in a fixed order with `config.js` first. Adding a file means adding it to that list.
- **No remote resource, ever.** MV3 CSP blocks it. Icons are inlined SVG in `popup/icons.js`; fonts are the two woff2 files already vendored for the design system, copied into `apps/extension/fonts/`.
- **The capture is safe before the UI says anything.** Every state in B1–B6 is reachable with the network down, and none of them can lose the file.
- **`background/config.js` holds `API_BASE_URL` / `WEB_BASE_URL`.** For local development swap to the commented-out localhost lines — **and swap back before shipping.** A task that leaves localhost in place is a failed task.
- **Do not hand-edit versions.** `./ship-to-store.sh` syncs `version.json`, `package.json` and `manifest.json`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/extension/styles/design-system.css` | **Rewritten.** The `--sr-*` tokens, transcribed from `packages/design-system/src/tokens.css` |
| `apps/extension/popup/popup.html` | **Rewritten.** One root element per view; no per-control markup |
| `apps/extension/popup/popup.css` | **Rewritten.** Reads `--sr-*` only |
| `apps/extension/popup/state.js` | New — the state machine: transitions, guards, derived values |
| `apps/extension/popup/render.js` | New — `render(state)` → DOM, one function per view |
| `apps/extension/popup/icons.js` | New — inlined SVG paths for the ~24 ant-design icons in use |
| `apps/extension/popup/popup.js` | **Rewritten.** Wires chrome APIs to `state.js`, calls `render` |
| `apps/extension/background/queue.js` | New — the offline upload queue |
| `apps/extension/background/storage.js` | **Modified.** Resumable upload, queue integration |
| `apps/extension/background/background.js` | **Modified.** `importScripts` order, alarm handler |
| `apps/extension/manifest.json` | **Modified.** `alarms` permission |
| `apps/extension/__tests__/*.test.js` | New — jsdom tests for `state.js` and `queue.js` |
| `apps/extension/vitest.config.js` | New |

`state.js` and `queue.js` are pure — no `chrome.*` calls inside them — so they are testable in jsdom. All chrome API access lives in `popup.js` and `background.js`.

---

## Task 1: Test harness and the token transcription

**Files:**
- Create: `apps/extension/vitest.config.js`
- Create: `apps/extension/package.json`
- Modify: `apps/extension/styles/design-system.css`
- Create: `apps/extension/__tests__/tokens.test.js`
- Modify: root `package.json` (workspace already covers `apps/*`)
- Modify: `Dockerfile` — **not needed**, `apps/extension` already has a `package.json` copied in both stages. Verify before assuming.

**Interfaces:**
- Consumes: `packages/design-system/src/tokens.css` as the source of truth.
- Produces: `npm run test --workspace=apps/extension`; a token file the popup CSS can read.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/__tests__/tokens.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const parse = (path) => {
  const css = readFileSync(resolve(__dirname, path), 'utf8');
  const out = {};
  for (const m of css.matchAll(/(--sr-[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
};

describe('extension tokens', () => {
  it('carries every token the design system defines', () => {
    const source = parse('../../../packages/design-system/src/tokens.css');
    const ext = parse('../styles/design-system.css');
    const missing = Object.keys(source).filter(k => !(k in ext));
    expect(missing).toEqual([]);
  });

  it('carries the same value for every token — no drift', () => {
    const source = parse('../../../packages/design-system/src/tokens.css');
    const ext = parse('../styles/design-system.css');
    const drifted = Object.entries(source)
      .filter(([k, v]) => k in ext && ext[k] !== v)
      .map(([k, v]) => `${k}: ${v} → ${ext[k]}`);
    expect(drifted).toEqual([]);
  });

  it('does not load any remote resource', () => {
    const css = readFileSync(resolve(__dirname, '../styles/design-system.css'), 'utf8');
    expect(css).not.toMatch(/@import\s+url\(['"]?https?:/);
    expect(css).not.toMatch(/url\(['"]?https?:/);
  });
});
```

- [ ] **Step 2: Add the harness**

Create `apps/extension/package.json`:

```json
{
  "name": "@snaprec/extension",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^25.0.1",
    "vitest": "^3.0.0"
  }
}
```

> If `apps/extension/package.json` already exists (`ship-to-store.sh` syncs a
> version into it), **do not overwrite it** — merge the `scripts` and
> `devDependencies` keys into the existing file and leave `version` alone.

Create `apps/extension/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.js'],
  },
});
```

Then: `npm install`

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test --workspace=apps/extension`
Expected: FAIL — the existing `styles/design-system.css` is missing most `--sr-*` tokens.

- [ ] **Step 4: Transcribe the tokens**

Replace `apps/extension/styles/design-system.css` with a copy of
`packages/design-system/src/tokens.css`, prefixed with this header:

```css
/* SnapRec — the plate, for MV3.
 *
 * A VERBATIM COPY of packages/design-system/src/tokens.css. The extension has
 * no build step, so it cannot import the package — but drift between the two
 * files is a real bug, so __tests__/tokens.test.js compares them value by
 * value and fails on any difference.
 *
 * To change a token: change it in the package, then copy the file here.
 * Never edit this file alone. */
```

Then append the extension's own font faces, pointing at vendored files:

```css
@font-face {
  font-family: 'Schibsted Grotesk Variable';
  src: url('../fonts/schibsted-grotesk-variable.woff2') format('woff2-variations');
  font-weight: 400 700;
  font-display: swap;
}
@font-face {
  font-family: 'Azeret Mono Variable';
  src: url('../fonts/azeret-mono-variable.woff2') format('woff2-variations');
  font-weight: 400 600;
  font-display: swap;
}
```

- [ ] **Step 5: Vendor the fonts**

```bash
mkdir -p apps/extension/fonts
cp node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2 \
   apps/extension/fonts/schibsted-grotesk-variable.woff2
cp node_modules/@fontsource-variable/azeret-mono/files/azeret-mono-latin-wght-normal.woff2 \
   apps/extension/fonts/azeret-mono-variable.woff2
```

Verify the source filenames first — fontsource's naming changes between majors:

```bash
ls node_modules/@fontsource-variable/schibsted-grotesk/files/ | grep latin-wght
```

- [ ] **Step 6: Run the tests**

Run: `npm run test --workspace=apps/extension`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/package.json apps/extension/vitest.config.js apps/extension/styles apps/extension/fonts apps/extension/__tests__ package-lock.json
git commit -m "feat(ext): add test harness and transcribe design tokens"
```

---

## Task 2: The popup state machine

**Files:**
- Create: `apps/extension/popup/state.js`
- Create: `apps/extension/__tests__/state.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```js
  // popup/state.js — pure, no chrome.* calls
  export const VIEWS = ['ready','screenshot','options','permission','denied',
                        'countdown','recording','paused','finishing',
                        'complete','uploading','uploadFailed','offline','saved','linkReady'];
  export function initialState()                 // → state object
  export function transition(state, event)       // → next state (pure)
  export function derive(state)                  // → { canStart, primaryLabel, coralTreatment, … }
  ```

Events: `{ type: 'SET_MODE', mode }`, `{ type: 'SET_SOURCE', source }`,
`{ type: 'TOGGLE_INPUT', input }`, `{ type: 'OPEN_OPTIONS' }`, `{ type: 'BACK' }`,
`{ type: 'START' }`, `{ type: 'TICK' }`, `{ type: 'PAUSE' }`, `{ type: 'RESUME' }`,
`{ type: 'STOP' }`, `{ type: 'FINISHED', capture }`, `{ type: 'UPLOAD' }`,
`{ type: 'UPLOAD_PROGRESS', pct, bytes }`, `{ type: 'UPLOAD_FAILED', reason, at }`,
`{ type: 'OFFLINE' }`, `{ type: 'SAVED' }`, `{ type: 'LINK_READY', url }`,
`{ type: 'CANCEL' }`, `{ type: 'PERMISSION_REQUIRED', input }`,
`{ type: 'PERMISSION_DENIED', input }`, `{ type: 'PERMISSION_GRANTED', input }`.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/__tests__/state.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { initialState, transition, derive } from '../popup/state.js';

const run = (events, from = initialState()) => events.reduce(transition, from);

describe('popup state machine', () => {
  it('starts ready to record with six controls and nothing else', () => {
    const s = initialState();
    expect(s.view).toBe('ready');
    expect(s.mode).toBe('record');
    expect(s.source).toBe('tab');
    expect(s.inputs).toEqual({ mic: true, tabAudio: true, camera: false });
  });

  it('drops audio inputs entirely in screenshot mode — not disabled, gone', () => {
    const s = transition(initialState(), { type: 'SET_MODE', mode: 'screenshot' });
    expect(s.view).toBe('screenshot');
    expect(derive(s).showsAudioInputs).toBe(false);
  });

  it('does not make the screenshot action coral — a screenshot is instantaneous', () => {
    const s = transition(initialState(), { type: 'SET_MODE', mode: 'screenshot' });
    expect(derive(s).primaryTone).toBe('carbon');
    expect(derive(initialState()).primaryTone).toBe('coral');
  });

  it('runs countdown → recording and writes nothing until recording starts', () => {
    let s = transition(initialState(), { type: 'START' });
    expect(s.view).toBe('countdown');
    expect(s.count).toBe(3);
    expect(derive(s).hasWrittenBytes).toBe(false);

    s = run([{ type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' }], s);
    expect(s.view).toBe('recording');
    expect(derive(s).hasWrittenBytes).toBe(true);
  });

  it('cancelling the countdown returns to ready and writes nothing', () => {
    const s = run([{ type: 'START' }, { type: 'TICK' }, { type: 'CANCEL' }]);
    expect(s.view).toBe('ready');
    expect(s.elapsed).toBe(0);
  });

  it('paused holds the duration and drops coral to outline', () => {
    let s = run([{ type: 'START' }, { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' }]);
    s = run([{ type: 'TICK' }, { type: 'TICK' }], s);
    const elapsed = s.elapsed;
    s = transition(s, { type: 'PAUSE' });
    expect(s.view).toBe('paused');
    expect(s.elapsed).toBe(elapsed);
    expect(derive(s).coralTreatment).toBe('outline');
    expect(derive(run([{ type: 'RESUME' }], s)).coralTreatment).toBe('filled');
  });

  it('offers no Copy link before a link exists', () => {
    const s = run([{ type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } }]);
    expect(s.view).toBe('complete');
    expect(derive(s).actions.map(a => a.key)).not.toContain('copyLink');
    expect(derive(s).primaryLabel).toBe('Upload and get link');
  });

  it('exposes Copy link only once the link resolves', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 7_200_000 },
      { type: 'LINK_READY', url: 'https://snaprecorder.org/v/abc' },
    ]);
    expect(s.view).toBe('linkReady');
    expect(derive(s).actions.map(a => a.key)).toContain('copyLink');
  });

  it('treats offline as queued, never as failure', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'OFFLINE' },
    ]);
    expect(s.view).toBe('offline');
    expect(derive(s).spineState).toBe('offline');
    expect(derive(s).usesCoral).toBe(false);
  });

  it('marks a failed upload with a break at the stopping point', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]);
    expect(s.view).toBe('uploadFailed');
    expect(derive(s).spineState).toBe('failed');
    expect(derive(s).breakAt).toBe(62);
    expect(derive(s).statusWord).toBe('stopped');
  });

  it('resumes a failed upload from where it stopped, not from zero', () => {
    let s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]);
    s = transition(s, { type: 'UPLOAD' });
    expect(s.view).toBe('uploading');
    expect(s.upload.pct).toBe(62);
  });

  it('cancelling an upload returns the file untouched to the local state', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 40, bytes: 2_880_000 },
      { type: 'CANCEL' },
    ]);
    expect(s.view).toBe('complete');
    expect(s.capture.id).toBe('c1');
  });

  it('keeps the recording path open when a permission is required', () => {
    const s = run([{ type: 'PERMISSION_REQUIRED', input: 'mic' }]);
    expect(s.view).toBe('permission');
    expect(derive(s).canProceedWithout).toBe(true);
  });

  it('uses cyan for permission-required and coral only once denied', () => {
    const required = run([{ type: 'PERMISSION_REQUIRED', input: 'mic' }]);
    expect(derive(required).usesCoral).toBe(false);
    const denied = transition(required, { type: 'PERMISSION_DENIED', input: 'mic' });
    expect(denied.view).toBe('denied');
    expect(derive(denied).usesCoral).toBe(true);
    expect(derive(denied).statusWord).toBe('blocked');
  });

  it('fires the corner strike exactly three times in a capture life', () => {
    const seen = [];
    let s = initialState();
    for (const e of [
      { type: 'START' },
      { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' },
      { type: 'STOP' },
      { type: 'FINISHED', capture: { id: 'c1', bytes: 1 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 1 },
      { type: 'LINK_READY', url: 'https://x' },
    ]) {
      s = transition(s, e);
      if (derive(s).strikesCorners) seen.push(s.view);
    }
    expect(seen).toEqual(['countdown', 'complete', 'linkReady']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/extension -- state`
Expected: FAIL — cannot resolve `../popup/state.js`.

- [ ] **Step 3: Write the implementation**

Create `apps/extension/popup/state.js`:

```js
/** The popup is a state machine, not a set of panels.
 *
 * This module is PURE — no chrome.* calls, no DOM. popup.js owns every side
 * effect. That is what makes the nine capture states testable in jsdom, and it
 * is the reason the file exists at all. */

export const VIEWS = [
  'ready', 'screenshot', 'options', 'permission', 'denied',
  'countdown', 'recording', 'paused', 'finishing',
  'complete', 'uploading', 'uploadFailed', 'offline', 'saved', 'linkReady',
];

export function initialState() {
  return {
    view: 'ready',
    mode: 'record',
    source: 'tab',
    inputs: { mic: true, tabAudio: true, camera: false },
    options: { resolution: '1080p', countdown: 3, autoZoom: true, cursor: true },
    count: 0,
    elapsed: 0,
    capture: null,
    upload: { pct: 0, bytes: 0, failedAt: null, reason: null },
    link: null,
    pendingPermission: null,
    returnTo: 'ready',
  };
}

const set = (s, patch) => ({ ...s, ...patch });

export function transition(state, event) {
  switch (event.type) {
    case 'SET_MODE':
      return set(state, { view: event.mode === 'screenshot' ? 'screenshot' : 'ready', mode: event.mode });

    case 'SET_SOURCE':
      return set(state, { source: event.source });

    case 'TOGGLE_INPUT':
      return set(state, { inputs: { ...state.inputs, [event.input]: !state.inputs[event.input] } });

    case 'OPEN_OPTIONS':
      return set(state, { view: 'options', returnTo: state.view });

    case 'BACK':
      return set(state, { view: state.returnTo });

    case 'START':
      return set(state, { view: 'countdown', count: state.options.countdown });

    case 'TICK': {
      if (state.view === 'countdown') {
        const next = state.count - 1;
        return next <= 0
          ? set(state, { view: 'recording', count: 0, elapsed: 0 })
          : set(state, { count: next });
      }
      if (state.view === 'recording') return set(state, { elapsed: state.elapsed + 1 });
      return state;
    }

    case 'PAUSE':
      return state.view === 'recording' ? set(state, { view: 'paused' }) : state;

    case 'RESUME':
      return state.view === 'paused' ? set(state, { view: 'recording' }) : state;

    case 'STOP':
      return set(state, { view: 'finishing' });

    case 'FINISHED':
      return set(state, { view: 'complete', capture: event.capture });

    case 'UPLOAD':
      // Resume from the failure point rather than restarting.
      return set(state, {
        view: 'uploading',
        upload: { ...state.upload, pct: state.upload.failedAt ?? state.upload.pct, failedAt: null, reason: null },
      });

    case 'UPLOAD_PROGRESS':
      return set(state, { upload: { ...state.upload, pct: event.pct, bytes: event.bytes } });

    case 'UPLOAD_FAILED':
      return set(state, {
        view: 'uploadFailed',
        upload: { ...state.upload, failedAt: event.at, reason: event.reason },
      });

    case 'OFFLINE':
      return set(state, { view: 'offline' });

    case 'SAVED':
      return set(state, { view: 'saved' });

    case 'LINK_READY':
      return set(state, { view: 'linkReady', link: event.url });

    case 'CANCEL':
      if (state.view === 'countdown') return set(state, { view: state.mode === 'screenshot' ? 'screenshot' : 'ready', count: 0, elapsed: 0 });
      if (state.view === 'uploading') return set(state, { view: 'complete' });
      return state;

    case 'PERMISSION_REQUIRED':
      return set(state, { view: 'permission', pendingPermission: event.input, returnTo: state.view });

    case 'PERMISSION_DENIED':
      return set(state, { view: 'denied', pendingPermission: event.input });

    case 'PERMISSION_GRANTED':
      return set(state, { view: state.returnTo, pendingPermission: null });

    default:
      return state;
  }
}

const CAPTURING = new Set(['recording', 'paused', 'finishing']);

/** Everything the renderer needs, derived — never stored. Keeping this separate
 * from `transition` is what stops the six design rules (coral reservation,
 * corner strike count, no-link-no-button, offline-is-not-failure) from being
 * re-decided per view. */
export function derive(state) {
  const v = state.view;

  const actions = [];
  if (v === 'complete' || v === 'saved' || v === 'linkReady' || v === 'uploadFailed' || v === 'offline') {
    if (v === 'linkReady') actions.push({ key: 'copyLink', label: 'Copy link', icon: 'link', tone: 'cyan' });
    actions.push({ key: 'copy', label: 'Copy', icon: 'copy' });
    actions.push({ key: 'download', label: 'Download', icon: 'download' });
    actions.push({ key: 'annotate', label: 'Annotate', icon: 'scissor' });
    actions.push(v === 'saved' || v === 'linkReady'
      ? { key: 'move', label: 'Move to collection', icon: 'folder' }
      : { key: 'drive', label: 'Save to Google Drive', icon: 'cloudUpload' });
    actions.push({ key: 'discard', label: 'Discard', icon: 'delete', destructive: true });
  }

  const primaryLabel = {
    ready: 'Start recording',
    screenshot: 'Capture',
    complete: 'Upload and get link',
    uploading: 'Cancel upload',
    uploadFailed: 'Try again',
    offline: 'Download now',
    saved: 'Create share link',
    linkReady: 'Copy link',
  }[v] ?? null;

  return {
    view: v,
    actions,
    primaryLabel,

    /** A screenshot is instantaneous, so its action is carbon. Coral means live
     * capture — keeping it off this button is what makes the countdown's coral
     * mean something. */
    primaryTone: v === 'ready' ? 'coral' : 'carbon',

    showsAudioInputs: state.mode === 'record',

    /** Filled coral = capturing right now. Paused keeps the boundary, empties
     * the fill, so a screenshot of the popup still distinguishes them. */
    coralTreatment: v === 'recording' ? 'filled' : v === 'paused' ? 'outline' : 'none',

    usesCoral: v === 'recording' || v === 'paused' || v === 'countdown'
      || v === 'denied' || v === 'uploadFailed',

    /** The countdown is the last moment where nothing has been captured. */
    hasWrittenBytes: CAPTURING.has(v),

    /** Fires exactly three times in a capture's life. */
    strikesCorners: v === 'countdown' || v === 'complete' || v === 'linkReady',

    spineState: v === 'uploadFailed' ? 'failed' : v === 'offline' ? 'offline' : 'normal',
    spineCurrent: { complete: 0, uploading: 1, uploadFailed: 1, offline: 1, saved: 2, linkReady: 3 }[v] ?? 0,
    breakAt: state.upload.failedAt,

    /** Status never rests on hue alone. */
    statusWord: {
      recording: 'recording', paused: 'paused', finishing: 'finishing',
      denied: 'blocked', uploadFailed: 'stopped', offline: 'queued',
      saved: 'private', linkReady: 'link ready', uploading: 'uploading',
      complete: 'on this device',
    }[v] ?? null,

    /** Permission is not a wall. */
    canProceedWithout: v === 'permission' || v === 'denied',

    canStart: v === 'ready' || v === 'screenshot',

    /** Indeterminate work never shows a fake percentage. */
    indeterminate: v === 'finishing',
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=apps/extension -- state`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/popup/state.js apps/extension/__tests__/state.test.js
git commit -m "feat(ext): add the popup state machine"
```

---

## Task 3: Inlined icons

**Files:**
- Create: `apps/extension/popup/icons.js`
- Create: `apps/extension/__tests__/icons.test.js`

**Interfaces:**
- Consumes: `@iconify-json/ant-design` at author time only — the output is static.
- Produces: `export const ICONS` — a record of `name → svg path data`, and `export function icon(name, size)` returning an SVG string.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/__tests__/icons.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ICONS, icon } from '../popup/icons.js';

const REQUIRED = [
  'videoCamera', 'camera', 'setting', 'chrome', 'desktop', 'expand',
  'audio', 'sound', 'user', 'right', 'left', 'close', 'check', 'minus',
  'link', 'copy', 'download', 'scissor', 'cloudUpload', 'folder', 'delete',
  'pause', 'play', 'reload', 'warning',
];

describe('inlined icons', () => {
  it('covers every icon the popup uses', () => {
    for (const name of REQUIRED) expect(ICONS).toHaveProperty(name);
  });

  it('renders a self-contained svg with no remote reference', () => {
    const svg = icon('camera', 14);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="14"');
    expect(svg).not.toMatch(/https?:/);
    expect(svg).toContain('currentColor');
  });

  it('marks icons decorative — every control carries its own label', () => {
    expect(icon('camera', 14)).toContain('aria-hidden="true"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/extension -- icons`
Expected: FAIL — cannot resolve `../popup/icons.js`.

- [ ] **Step 3: Generate the icon file**

Write a one-off generator at `apps/extension/scripts/build-icons.mjs`:

```js
/** Regenerates popup/icons.js from @iconify-json/ant-design.
 *
 * MV3 forbids remote resources and the popup has no bundler, so the icon paths
 * are checked in as static data. Re-run this only when the icon list changes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const set = JSON.parse(readFileSync(
  resolve(here, '../../../node_modules/@iconify-json/ant-design/icons.json'), 'utf8'));

const MAP = {
  videoCamera: 'video-camera-outlined', camera: 'camera-outlined',
  setting: 'setting-outlined', chrome: 'chrome-outlined',
  desktop: 'desktop-outlined', expand: 'expand-outlined',
  audio: 'audio-outlined', sound: 'sound-outlined', user: 'user-outlined',
  right: 'right-outlined', left: 'left-outlined', close: 'close-outlined',
  check: 'check-outlined', minus: 'minus-outlined', link: 'link-outlined',
  copy: 'copy-outlined', download: 'download-outlined',
  scissor: 'scissor-outlined', cloudUpload: 'cloud-upload-outlined',
  folder: 'folder-outlined', delete: 'delete-outlined',
  pause: 'pause-outlined', play: 'caret-right-outlined',
  reload: 'reload-outlined', warning: 'warning-outlined',
};

const out = {};
for (const [key, name] of Object.entries(MAP)) {
  const it = set.icons[name];
  if (!it) throw new Error(`missing icon: ${name}`);
  out[key] = { body: it.body, w: it.width ?? set.width ?? 24, h: it.height ?? set.height ?? 24 };
}

writeFileSync(resolve(here, '../popup/icons.js'),
`/* GENERATED by scripts/build-icons.mjs — do not edit by hand.
 * MV3 forbids remote resources; these paths are checked in deliberately. */
export const ICONS = ${JSON.stringify(out, null, 2)};

export function icon(name, size = 16) {
  const i = ICONS[name];
  if (!i) throw new Error('unknown icon: ' + name);
  return '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" ' +
    'width="' + size + '" height="' + size + '" viewBox="0 0 ' + i.w + ' ' + i.h + '" ' +
    'fill="currentColor">' + i.body + '</svg>';
}
`);
console.log(`wrote ${Object.keys(out).length} icons`);
```

Run: `node apps/extension/scripts/build-icons.mjs`

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=apps/extension -- icons`
Expected: PASS, 3 tests. If the `currentColor` assertion fails, the iconify body
already carries `fill="currentColor"` inline — adjust the generator's `fill`
attribute rather than the test.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/popup/icons.js apps/extension/scripts/build-icons.mjs apps/extension/__tests__/icons.test.js
git commit -m "feat(ext): inline the ant-design icons the popup uses"
```

---

## Task 4: The record and screenshot views (A1, A2)

**Files:**
- Create: `apps/extension/popup/render.js`
- Rewrite: `apps/extension/popup/popup.html`
- Rewrite: `apps/extension/popup/popup.css`
- Create: `apps/extension/__tests__/render.test.js`

**Interfaces:**
- Consumes: `derive`, `initialState`, `transition` (Task 2); `icon` (Task 3).
- Produces: `export function render(state, dispatch)` → sets `innerHTML` of `#root` and binds listeners.

- [ ] **Step 1: Write the failing test**

Create `apps/extension/__tests__/render.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initialState, transition } from '../popup/state.js';
import { render } from '../popup/render.js';

const mount = (state, dispatch = vi.fn()) => {
  document.body.innerHTML = '<div id="root"></div>';
  render(state, dispatch);
  return document.getElementById('root');
};

describe('record view (A1)', () => {
  it('offers exactly six controls', () => {
    const root = mount(initialState());
    expect(root.querySelectorAll('[data-control]')).toHaveLength(6);
  });

  it('shows no meters — those live behind Recording options', () => {
    const root = mount(initialState());
    expect(root.querySelector('[data-meter]')).toBeNull();
  });

  it('exposes mode as a tablist and source as a radiogroup', () => {
    const root = mount(initialState());
    expect(root.querySelector('[role="tablist"]')).toBeTruthy();
    expect(root.querySelector('[role="radiogroup"][aria-label="Recording source"]')).toBeTruthy();
  });

  it('ends tab order on the capture action', () => {
    const root = mount(initialState());
    const focusable = [...root.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')];
    expect(focusable.at(-1).dataset.action).toBe('primary');
  });

  it('names the keyboard shortcut in text, not only as a binding', () => {
    const root = mount(initialState());
    expect(root.textContent).toContain('⌥⇧R');
  });

  it('states where the capture goes', () => {
    const root = mount(initialState());
    expect(root.textContent).toContain('Saves to this device. No account needed.');
  });
});

describe('screenshot view (A2)', () => {
  const shot = transition(initialState(), { type: 'SET_MODE', mode: 'screenshot' });

  it('removes audio controls rather than disabling them', () => {
    const root = mount(shot);
    expect(root.querySelector('[data-control="mic"]')).toBeNull();
    expect(root.querySelector('[data-control="tabAudio"]')).toBeNull();
    expect(root.querySelector('[disabled]')).toBeNull();
  });

  it('offers three capture areas, each with its shortcut spelled out', () => {
    const root = mount(shot);
    const areas = root.querySelectorAll('[data-area]');
    expect(areas).toHaveLength(3);
    for (const a of areas) expect(a.textContent).toMatch(/⌥⇧/);
  });

  it('does not render the capture action in coral', () => {
    const root = mount(shot);
    expect(root.querySelector('[data-action="primary"]').dataset.tone).toBe('carbon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/extension -- render`
Expected: FAIL — cannot resolve `../popup/render.js`.

- [ ] **Step 3: Write the HTML shell**

Replace `apps/extension/popup/popup.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="../styles/design-system.css">
  <link rel="stylesheet" href="popup.css">
  <title>SnapRec</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

> Every control is now rendered by `render.js`. Do not reintroduce markup here —
> the state machine is the only thing that decides what exists.

- [ ] **Step 4: Write the renderer**

Create `apps/extension/popup/render.js`. Implement `render(state, dispatch)` with
one `view*` function per state. Start with the two this task covers:

```js
import { derive } from './state.js';
import { icon } from './icons.js';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function header(state) {
  return `
    <div class="sr-popup-header">
      <span class="sr-brand">${icon('videoCamera', 14)}SnapRec</span>
      <span class="sr-brand-meta">
        <span data-account>${state.account ?? ''}</span>
        <button type="button" data-nav="settings" aria-label="Settings" title="Settings">${icon('setting', 14)}</button>
      </span>
    </div>`;
}

function modeTabs(state) {
  const on = (m) => state.mode === m;
  return `
    <div class="sr-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="${on('record')}" data-mode="record">
        ${icon('videoCamera', 13)}Record</button>
      <button type="button" role="tab" aria-selected="${on('screenshot')}" data-mode="screenshot">
        ${icon('camera', 13)}Screenshot</button>
    </div>`;
}

function sourceGroup(state) {
  const opts = [
    ['tab', 'This tab', 'chrome'],
    ['window', 'Window', 'desktop'],
    ['screen', 'Screen', 'expand'],
  ];
  return `
    <div class="sr-radiogroup" role="radiogroup" aria-label="Recording source">
      ${opts.map(([k, label, ic]) => `
        <button type="button" role="radio" aria-checked="${state.source === k}"
                data-control="source" data-source="${k}">
          ${icon(ic, 13)}${label}</button>`).join('')}
    </div>`;
}

function inputRow(state, key, label, ic, detail) {
  const on = state.inputs[key];
  return `
    <div class="sr-input-row" data-control="${key}" data-on="${on}">
      ${icon(ic, 14)}
      <span class="sr-input-label">${label}</span>
      ${detail ? `<span class="sr-input-detail">${detail}</span>` : ''}
      <button type="button" role="switch" aria-checked="${on}" aria-label="${label}"
              data-toggle="${key}"><span></span></button>
    </div>`;
}

function primaryAction(d, label) {
  return `
    <button type="button" class="sr-primary" data-action="primary" data-tone="${d.primaryTone}">
      ${d.primaryTone === 'coral' ? '<span class="sr-dot"></span>' : ''}${label}
      <span class="sr-shortcut">⌥⇧R</span>
    </button>`;
}

function viewReady(state, d) {
  return `
    ${header(state)}
    ${modeTabs(state)}
    <div class="sr-preview"><div class="sr-frame" data-treatment="focused"></div>
      <span class="sr-preview-url">${state.previewUrl ?? ''}</span></div>
    ${sourceGroup(state)}
    <div class="sr-inputs">
      ${inputRow(state, 'mic', 'Microphone', 'audio', state.micDevice ?? '')}
      ${inputRow(state, 'tabAudio', 'Tab audio', 'sound', '')}
      ${inputRow(state, 'camera', 'Camera', 'user', state.inputs.camera ? '' : 'off')}
    </div>
    <button type="button" class="sr-options-toggle" data-nav="options">
      ${icon('right', 10)}Recording options
      <span class="sr-options-summary">${state.options.resolution} · ${state.options.countdown}s · auto-zoom ${state.options.autoZoom ? 'on' : 'off'}</span>
    </button>
    <div class="sr-footer">
      ${primaryAction(d, 'Start recording')}
      <p class="sr-footnote">Saves to this device. No account needed.</p>
    </div>`;
}

function viewScreenshot(state, d) {
  const areas = [
    ['visible', 'Visible area', 'Whatever’s on screen, instantly.', '⌥⇧V'],
    ['region', 'Select a region', 'Drag a box with live dimensions and a magnifier.', '⌥⇧X'],
    ['fullpage', 'Full page', 'Scrolls and stitches the whole page, however long.', '⌥⇧F'],
  ];
  return `
    ${header(state)}
    ${modeTabs(state)}
    <div class="sr-preview"><div class="sr-frame" data-treatment="focused"></div></div>
    <div class="sr-areas">
      ${areas.map(([k, label, body, sc]) => `
        <button type="button" data-area="${k}">
          <span class="sr-area-label">${label}</span>
          <span class="sr-area-body">${body}</span>
          <span class="sr-shortcut">${sc}</span>
        </button>`).join('')}
    </div>
    <div class="sr-footer">
      ${primaryAction(d, 'Capture')}
      <p class="sr-footnote">Saves to this device. No account needed.</p>
    </div>`;
}

const VIEWS = {
  ready: viewReady,
  screenshot: viewScreenshot,
  // options, permission, denied, countdown, recording, paused, finishing → Task 5
  // complete, uploading, uploadFailed, offline, saved, linkReady → Task 6
};

export function render(state, dispatch) {
  const root = document.getElementById('root');
  const d = derive(state);
  const view = VIEWS[state.view];
  if (!view) throw new Error(`no renderer for view: ${state.view}`);
  root.innerHTML = view(state, d);
  bind(root, dispatch);
}

function bind(root, dispatch) {
  root.querySelectorAll('[data-mode]').forEach(b =>
    b.addEventListener('click', () => dispatch({ type: 'SET_MODE', mode: b.dataset.mode })));
  root.querySelectorAll('[data-source]').forEach(b =>
    b.addEventListener('click', () => dispatch({ type: 'SET_SOURCE', source: b.dataset.source })));
  root.querySelectorAll('[data-toggle]').forEach(b =>
    b.addEventListener('click', () => dispatch({ type: 'TOGGLE_INPUT', input: b.dataset.toggle })));
  root.querySelectorAll('[data-nav="options"]').forEach(b =>
    b.addEventListener('click', () => dispatch({ type: 'OPEN_OPTIONS' })));
  root.querySelectorAll('[data-action="primary"]').forEach(b =>
    b.addEventListener('click', () => dispatch({ type: 'START' })));
}
```

- [ ] **Step 5: Write the CSS**

Replace `apps/extension/popup/popup.css`. It must read `--sr-*` only — no hex
literals. Key values from the prototype (scene A1):

```css
body { margin: 0; width: 360px; background: var(--sr-surface-carbon);
       color: var(--sr-text-primary-on-dark); font-family: var(--sr-font-ui);
       -webkit-font-smoothing: antialiased; }

.sr-popup-header { display: flex; align-items: center; justify-content: space-between;
  height: 38px; padding: 0 12px; border-bottom: 1px solid var(--sr-border-dark-soft);
  font-size: 13px; font-weight: 600; }
.sr-brand { display: inline-flex; align-items: center; gap: 8px; }
.sr-brand-meta { display: inline-flex; align-items: center; gap: 10px;
  font-size: 10px; color: var(--sr-text-faint-on-dark); }

.sr-tabs { display: flex; height: 32px; border-bottom: 1px solid var(--sr-border-dark-soft); }
.sr-tabs button { flex: 1; border: none; background: transparent; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--sr-text-muted-on-dark); font-family: inherit; }
.sr-tabs button[aria-selected="true"] { background: var(--sr-text-primary-on-dark);
  color: var(--sr-surface-carbon); font-weight: 600; }

.sr-radiogroup { display: flex; margin: 10px 12px 0; border: 1px solid var(--sr-border-dark); }
.sr-radiogroup button { flex: 1; height: var(--sr-h-sm); border: none; background: transparent;
  color: var(--sr-text-secondary-on-dark); font-size: 11.5px; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.sr-radiogroup button + button { border-left: 1px solid var(--sr-border-dark); }
.sr-radiogroup button[aria-checked="true"] { background: var(--sr-cyan);
  color: var(--sr-cyan-fg); font-weight: 600; }

.sr-inputs { display: flex; flex-direction: column; gap: 1px; padding: 12px 12px 0; }
.sr-input-row { display: flex; align-items: center; gap: 10px; height: var(--sr-h-row);
  padding: 0 10px; background: var(--sr-surface-panel-dark); }
.sr-input-row[data-on="false"] { background: var(--sr-surface-panel-dark-alt);
  color: var(--sr-text-faint-on-dark); }
.sr-input-label { font-size: 12.5px; flex: 1; }
.sr-input-detail { font-size: 9.5px; color: var(--sr-text-faint-on-dark); }

.sr-primary { width: 100%; height: var(--sr-h-lg); border: none; cursor: pointer;
  font-size: 14.5px; font-weight: 600; font-family: inherit; position: relative;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  border-radius: var(--sr-radius-control); }
.sr-primary[data-tone="coral"] { background: var(--sr-coral-text); color: var(--sr-coral-text-fg); }
.sr-primary[data-tone="coral"]:hover { background: var(--sr-coral-hover); }
.sr-primary[data-tone="carbon"] { background: var(--sr-text-primary-on-dark);
  color: var(--sr-surface-carbon); }
.sr-dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
.sr-shortcut { position: absolute; right: 12px; font-family: var(--sr-font-mono); font-size: 10px; }

.sr-footnote { margin: 8px 0 0; font-size: 9.5px; color: var(--sr-text-faint-on-dark); text-align: center; }

/* The popup opens with a 120ms fade only. Nothing loops. */
#root { animation: sr-fade var(--sr-dur-fast) var(--sr-ease); }
@keyframes sr-fade { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { #root { animation: none } }
```

- [ ] **Step 6: Run the tests**

Run: `npm run test --workspace=apps/extension -- render`
Expected: PASS, 9 tests.

- [ ] **Step 7: Verify in Chrome**

Load `apps/extension` unpacked. The popup opens at 360px in the record view with
six controls. Switching to Screenshot removes the audio rows entirely. Confirm no
console errors and no network requests in DevTools.

- [ ] **Step 8: Commit**

```bash
git add apps/extension/popup apps/extension/__tests__/render.test.js
git commit -m "feat(ext): rebuild the record and screenshot views on the state machine"
```

---

## Task 5: Options, permission, countdown, recording, paused, finishing (A3–A9)

**Files:**
- Modify: `apps/extension/popup/render.js`
- Modify: `apps/extension/popup/popup.css`
- Modify: `apps/extension/__tests__/render.test.js`
- Modify: `apps/extension/content/content.css` — the in-page recording bar

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: seven more entries in `VIEWS`; the in-page bar's `.sr-recording-bar` class contract.

- [ ] **Step 1: Write the failing tests**

Append to `apps/extension/__tests__/render.test.js`:

```js
describe('recording options (A3)', () => {
  const opts = transition(initialState(), { type: 'OPEN_OPTIONS' });

  it('is the only view with a meter, because a device is being chosen here', () => {
    expect(mount(opts).querySelector('[data-meter]')).toBeTruthy();
    expect(mount(initialState()).querySelector('[data-meter]')).toBeNull();
  });

  it('uses fixed 36px rows so the layout holds at 125% zoom', () => {
    const root = mount(opts);
    for (const r of root.querySelectorAll('.sr-option-row')) {
      expect(getComputedStyle(r).getPropertyValue('height')).toBe('');
    }
    expect(root.querySelectorAll('.sr-option-row').length).toBeGreaterThan(0);
  });

  it('keeps the header and Done fixed while the panel scrolls', () => {
    const root = mount(opts);
    expect(root.querySelector('.sr-options-scroll')).toBeTruthy();
    expect(root.querySelector('[data-nav="back"]')).toBeTruthy();
  });
});

describe('permission (A4) and denial (A5)', () => {
  it('keeps the recording path open and offers to proceed without', () => {
    const root = mount(transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' }));
    expect(root.querySelector('[data-action="proceed-without"]')).toBeTruthy();
  });

  it('moves focus to the heading and announces it', () => {
    const root = mount(transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' }));
    const h = root.querySelector('[data-focus-target]');
    expect(h).toBeTruthy();
    expect(h.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it('names the state in words alongside the coral rule', () => {
    let s = transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' });
    s = transition(s, { type: 'PERMISSION_DENIED', input: 'mic' });
    expect(mount(s).textContent).toContain('blocked');
  });

  it('offers a re-check that does not require a reload', () => {
    let s = transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' });
    s = transition(s, { type: 'PERMISSION_DENIED', input: 'mic' });
    expect(mount(s).querySelector('[data-action="recheck"]')).toBeTruthy();
  });

  it('mentions no permission API and offers no apology', () => {
    let s = transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' });
    s = transition(s, { type: 'PERMISSION_DENIED', input: 'mic' });
    const text = mount(s).textContent.toLowerCase();
    expect(text).not.toContain('permission api');
    expect(text).not.toContain('sorry');
    expect(text).not.toContain('getusermedia');
  });
});

describe('countdown (A6)', () => {
  it('offers Esc as well as Cancel', () => {
    const root = mount(transition(initialState(), { type: 'START' }));
    expect(root.textContent).toContain('Esc');
    expect(root.querySelector('[data-action="cancel"]')).toBeTruthy();
  });

  it('states that nothing has been captured yet', () => {
    const root = mount(transition(initialState(), { type: 'START' }));
    expect(root.querySelector('[data-strike]')).toBeTruthy();
  });
});

describe('recording (A7) and paused (A8)', () => {
  const rec = [{ type: 'START' }, { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' }]
    .reduce(transition, initialState());

  it('turns the header coral while live', () => {
    expect(mount(rec).querySelector('.sr-popup-header').dataset.tone).toBe('coral');
  });

  it('announces elapsed time politely, not every second', () => {
    const timer = mount(rec).querySelector('[data-timer]');
    expect(timer.getAttribute('aria-live')).toBe('polite');
    expect(timer.dataset.announceEvery).toBe('10');
  });

  it('empties the coral fill when paused and holds the duration', () => {
    const paused = transition(rec, { type: 'PAUSE' });
    const root = mount(paused);
    expect(root.querySelector('.sr-popup-header').dataset.tone).toBe('coral-outline');
    expect(root.querySelector('[data-timer]').textContent).toBe(mount(rec).querySelector('[data-timer]').textContent);
  });

  it('separates Discard from the primary pair and names what is lost', () => {
    const paused = transition(rec, { type: 'PAUSE' });
    const discard = mount(paused).querySelector('[data-action="discard"]');
    expect(discard.closest('[data-separated]')).toBeTruthy();
    expect(discard.dataset.confirm).toMatch(/\d+:\d\d/);
  });
});

describe('finishing (A9)', () => {
  const fin = transition(initialState(), { type: 'STOP' });

  it('uses an indeterminate sweep, never a fake percentage', () => {
    const root = mount(fin);
    expect(root.querySelector('[data-sweep]')).toBeTruthy();
    expect(root.textContent).not.toMatch(/\d+%/);
  });

  it('says the file is being written locally', () => {
    expect(mount(fin).textContent.toLowerCase()).toContain('this device');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/extension -- render`
Expected: FAIL — `no renderer for view: options`.

- [ ] **Step 3: Implement the seven views**

Add to `apps/extension/popup/render.js`. The contracts the tests pin down:

- `viewOptions` — a fixed header, a `.sr-options-scroll` body of `.sr-option-row`
  elements (36px, set in CSS), a `[data-meter]` beside the mic select, and a
  `[data-nav="back"]` Done button outside the scroll region. Slides in from the
  right over `var(--sr-dur-mid)`; `BACK` reverses it. The transition must be
  interruptible — do not gate dispatch on `transitionend`.
- `viewPermission` — occupies the preview area only, so the popup does not resize.
  Wraps the heading in `<div aria-live="polite">` with `data-focus-target` on the
  heading itself; `popup.js` calls `.focus()` after render. Cyan, not coral.
  Carries `[data-action="proceed-without"]`.
- `viewDenied` — coral rule plus the word `blocked`. Three concrete steps. A
  `[data-action="recheck"]` that dispatches `PERMISSION_GRANTED` or re-dispatches
  `PERMISSION_DENIED`. Copy names what happened, what still works, what to do.
- `viewCountdown` — `[data-strike]` on the frame, the numeral, `Esc` named in
  text, `[data-action="cancel"]`.
- `viewRecording` — `.sr-popup-header[data-tone="coral"]`, `[data-timer]` with
  `aria-live="polite"` and `data-announce-every="10"`, pause and stop.
- `viewPaused` — `data-tone="coral-outline"`, the same timer value, and a
  `[data-separated]` wrapper holding `[data-action="discard"]` whose
  `data-confirm` names the duration.
- `viewFinishing` — `[data-sweep]`, no percentage, copy naming the device.

- [ ] **Step 4: Add the motion**

Append to `apps/extension/popup/popup.css`:

```css
/* The signature strike. Fires three times in a capture's life and nowhere else:
 * the countdown, capture completion, and link resolution. */
@keyframes sr-strike {
  from { opacity: 0; transform: translate(var(--sr-strike-x), var(--sr-strike-y)) }
  to   { opacity: 1; transform: none }
}
[data-strike] .sr-mark { animation: sr-strike var(--sr-dur-slow) var(--sr-ease) both; }

@keyframes sr-count { from { transform: scale(1.25) } to { transform: scale(1) } }
[data-strike] .sr-numeral { animation: sr-count 300ms var(--sr-ease); }

/* Only the record dot animates. */
@keyframes sr-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
.sr-popup-header[data-tone="coral"] .sr-dot { animation: sr-pulse 1.6s ease-in-out infinite; }

/* Indeterminate: a sweeping segment, never a fake percentage. */
@keyframes sr-sweep { from { left: -32% } to { left: 100% } }
[data-sweep] { position: relative; overflow: hidden; height: 3px;
  background: var(--sr-border-dark); }
[data-sweep]::after { content: ''; position: absolute; top: 0; bottom: 0; width: 32%;
  background: var(--sr-cyan); animation: sr-sweep 1.1s var(--sr-ease) infinite; }

.sr-popup-header[data-tone="coral"] { background: var(--sr-coral-text);
  color: var(--sr-coral-text-fg); border-bottom-color: var(--sr-coral-text); }
.sr-popup-header[data-tone="coral-outline"] { background: transparent;
  box-shadow: inset 0 0 0 1px var(--sr-coral-text); color: var(--sr-coral-on-dark); }

.sr-option-row { height: var(--sr-h-row); display: flex; align-items: center; gap: 10px;
  padding: 0 10px; background: var(--sr-surface-panel-dark); }
.sr-options-scroll { max-height: 320px; overflow-y: auto; }

/* Reduced motion: numerals swap without scaling, corners appear at full opacity,
 * the record dot holds solid. Timing is unchanged so the countdown stays truthful. */
@media (prefers-reduced-motion: reduce) {
  [data-strike] .sr-mark, [data-strike] .sr-numeral,
  .sr-popup-header[data-tone="coral"] .sr-dot { animation: none; }
  [data-sweep]::after { animation: none; width: 100%; opacity: .4; }
}
```

- [ ] **Step 5: Style the in-page recording bar**

In `apps/extension/content/content.css`, replace the recording-bar rules:

```css
/* The in-page bar is not site content. A fixed 42px height, carbon body, 1px
 * light border and a strong outer shadow keep it legible on any page. It never
 * inherits page fonts. */
.snaprec-recording-bar {
  all: initial;
  position: fixed; z-index: 2147483647;
  height: 42px; display: flex; align-items: center; gap: 10px; padding: 0 12px;
  background: #0C1011; border: 1px solid #C7CFD0;
  box-shadow: 0 8px 28px rgba(0,0,0,.42);
  font-family: 'Schibsted Grotesk Variable', system-ui, sans-serif;
  color: #F3F6F6;
}
.snaprec-recording-bar .snaprec-timer {
  font-family: 'Azeret Mono Variable', ui-monospace, monospace; font-size: 13px;
}
.snaprec-recording-bar .snaprec-dot {
  width: 9px; height: 9px; border-radius: 50%; background: #FF3B2E;
  animation: snaprec-pulse 1.6s ease-in-out infinite;
}
@keyframes snaprec-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) { .snaprec-recording-bar .snaprec-dot { animation: none } }
```

> `content.css` is injected into arbitrary pages and cannot read `--sr-*`, so
> hex literals are correct here and only here. Keep them in sync by hand and add
> a comment naming the token each one mirrors.

- [ ] **Step 6: Make the bar a landmark**

In `apps/extension/content/content.js`, give the bar `role="region"` and
`aria-label="SnapRec recording controls"`, register the `⌥⇧B` shortcut to focus
it, and give every icon control a `title` and `aria-label`.

- [ ] **Step 7: Run the tests**

Run: `npm run test --workspace=apps/extension`
Expected: PASS, all suites.

- [ ] **Step 8: Verify in Chrome**

Record a real 20-second capture. Confirm: countdown numerals scale once each,
the in-page bar is legible on a dark site and a light one, pausing empties the
coral fill and holds the timer, and `prefers-reduced-motion` (DevTools →
Rendering → Emulate CSS media) stops every animation without changing timing.

- [ ] **Step 9: Commit**

```bash
git add apps/extension/popup apps/extension/content apps/extension/__tests__
git commit -m "feat(ext): add options, permission, countdown, recording, paused and finishing views"
```

---

## Task 6: The capture completion surface (B1–B6)

**Files:**
- Modify: `apps/extension/popup/render.js`
- Modify: `apps/extension/popup/popup.css`
- Modify: `apps/extension/__tests__/render.test.js`

**Interfaces:**
- Consumes: `derive().actions`, `spineState`, `spineCurrent`, `breakAt` (Task 2).
- Produces: six more entries in `VIEWS`, and a `spine(state)` helper mirroring the design system's `PathSpine`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/extension/__tests__/render.test.js`:

```js
const finished = (extra = []) => [
  { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000, duration: '0:47' } },
  ...extra,
].reduce(transition, initialState());

describe('capture completion (B1–B6)', () => {
  it('B1 offers no Copy link, because there is no link', () => {
    const root = mount(finished());
    expect(root.querySelector('[data-action-key="copyLink"]')).toBeNull();
    expect(root.querySelector('[data-action="primary"]').textContent).toContain('Upload and get link');
  });

  it('B1 draws the four-node spine with the first node entered', () => {
    const nodes = mount(finished()).querySelectorAll('[data-spine-node]');
    expect(nodes).toHaveLength(4);
    expect(nodes[0].dataset.state).toBe('current');
  });

  it('B1 uses a focused frame, never handles — Annotate opens the editor', () => {
    const root = mount(finished());
    expect(root.querySelector('.sr-frame').dataset.treatment).toBe('focused');
    expect(root.querySelector('[data-handle]')).toBeNull();
  });

  it('B2 names bytes, not just a percentage', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 }]));
    expect(root.textContent).toContain('62%');
    expect(root.textContent).toMatch(/4\.5 of 7\.2 MB/);
  });

  it('B2 throttles progress announcements to every 25%', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 }]));
    expect(root.querySelector('[role="progressbar"]').dataset.announceEvery).toBe('25');
  });

  it('B2 gives every disabled edge action a reason', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 }]));
    for (const b of root.querySelectorAll('[data-action-key][aria-disabled="true"]')) {
      expect(b.getAttribute('title')).toBeTruthy();
    }
  });

  it('B3 states the file is safe before anything else', () => {
    const root = mount(finished([
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]));
    const body = root.querySelector('[data-failure-body]').textContent;
    expect(body.indexOf('still on this device')).toBeLessThan(body.indexOf('Try again'));
  });

  it('B3 marks the break point and names it in words', () => {
    const root = mount(finished([
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]));
    expect(root.querySelector('[data-spine-break]').style.left).toBe('62%');
    expect(root.textContent).toContain('stopped');
  });

  it('B3 renders retry as a normal carbon action, not an emergency', () => {
    const root = mount(finished([
      { type: 'UPLOAD' },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]));
    expect(root.querySelector('[data-action="primary"]').dataset.tone).toBe('carbon');
  });

  it('B4 uses dashed grey and says closing is safe', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'OFFLINE' }]));
    expect(root.querySelector('[data-spine-segment="1"]').dataset.treatment).toBe('dashed');
    expect(root.textContent.toLowerCase()).toContain('you can close');
    expect(root.textContent.toLowerCase()).not.toContain('failed');
  });

  it('B5 says uploaded is not shared', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 7_200_000 }, { type: 'SAVED' }]));
    expect(root.querySelectorAll('[data-spine-node][data-state="done"]')).toHaveLength(3);
    expect(root.textContent).toContain('no link yet');
    expect(root.textContent).toContain('private');
  });

  it('B5 swaps the Drive slot for Move to collection', () => {
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'SAVED' }]));
    expect(root.querySelector('[data-action-key="drive"]')).toBeNull();
    expect(root.querySelector('[data-action-key="move"]')).toBeTruthy();
  });

  it('B6 exposes the link in both the rail and the field', () => {
    const root = mount(finished([
      { type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 7_200_000 },
      { type: 'LINK_READY', url: 'https://www.snaprecorder.org/v/abc' },
    ]));
    expect(root.querySelector('[data-action-key="copyLink"]')).toBeTruthy();
    expect(root.querySelector('[data-link-field]').value).toBe('https://www.snaprecorder.org/v/abc');
  });

  it('B6 puts permissions beside the link, not behind a settings screen', () => {
    const root = mount(finished([
      { type: 'UPLOAD' }, { type: 'LINK_READY', url: 'https://x' },
    ]));
    expect(root.querySelector('[data-permission="visibility"]')).toBeTruthy();
    expect(root.querySelector('[data-permission="download"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/extension -- render`
Expected: FAIL — `no renderer for view: complete`.

- [ ] **Step 3: Write the spine helper**

Add to `apps/extension/popup/render.js`:

```js
const PATH_NODES = ['on this device', 'uploading', 'saved to library', 'link ready'];

/** Mirrors packages/design-system PathSpine. The extension cannot import it, so
 * the treatments are duplicated here — and the vocabulary above must stay
 * identical to src/status.ts PATH_NODES. */
function spine(d, pct) {
  return `
    <div class="sr-spine" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${pct ?? 0}" data-announce-every="25"
         aria-valuetext="${PATH_NODES[Math.min(d.spineCurrent, 3)]}${d.spineState === 'failed' ? ' — stopped' : ''}">
      ${PATH_NODES.map((node, i) => {
        const done = i < d.spineCurrent;
        const current = i === d.spineCurrent;
        const treatment = !current ? (done ? 'done' : 'pending')
          : d.spineState === 'failed' ? 'failed'
          : d.spineState === 'offline' ? 'dashed' : 'active';
        return `
          <div class="sr-spine-col">
            <div class="sr-spine-track">
              <span data-spine-segment="${i}" data-treatment="${treatment}"
                    style="width:${done ? 100 : current ? (pct ?? 100) : 0}%"></span>
              ${current && d.spineState === 'failed' && d.breakAt != null
                ? `<span data-spine-break style="left:${d.breakAt}%"></span>` : ''}
            </div>
            <span data-spine-node data-state="${done ? 'done' : current ? 'current' : 'pending'}"></span>
            <span class="sr-spine-label">${node}</span>
          </div>`;
      }).join('')}
    </div>`;
}

const MB = (bytes) => (bytes / 1_048_576).toFixed(1);

function edgeRail(d) {
  return `
    <div class="sr-edge-rail">
      ${d.actions.map(a => `
        <button type="button" data-action-key="${a.key}"
                ${a.disabledReason ? `aria-disabled="true" title="${a.disabledReason}"` : `title="${a.label}"`}
                aria-label="${a.label}" ${a.destructive ? 'data-destructive' : ''}
                ${a.tone ? `data-tone="${a.tone}"` : ''}>
          ${icon(a.icon, 16)}</button>`).join('')}
    </div>`;
}
```

- [ ] **Step 4: Implement the six views**

Contracts the tests pin down:

- `viewComplete` (B1) — heading "Recording finished", a `.sr-frame[data-treatment="focused"]`,
  the edge rail, `spine(d)` at node 0, primary "Upload and get link" (cyan),
  secondary "Save to library" and "Annotate". Fires `[data-strike]`.
- `viewUploading` (B2) — the same plate with a cyan rule filling along the
  media's bottom edge, `spine(d, pct)`, the label
  `${pct}% · ${MB(bytes)} of ${MB(total)} MB`, primary "Cancel upload".
  Disabled edge actions carry `title="Available once the upload finishes"`.
- `viewUploadFailed` (B3) — `[data-failure-body]` whose **first sentence** states
  the file is still on this device, then the cause, then two actions. Spine
  breaks at `d.breakAt` with a tick. The word `stopped`. Primary is carbon.
- `viewOffline` (B4) — dashed grey segment, copy "Queued. It will upload when
  you're back online — you can close this window." No coral, no failure language.
- `viewSaved` (B5) — three nodes done, fourth reads "no link yet", a `private`
  badge on the media, primary "Create share link", Drive slot replaced by
  "Move to collection".
- `viewLinkReady` (B6) — `[data-link-field]` input holding the URL, a Copy button,
  the first edge slot turned cyan (`data-tone="cyan"`), and two permission
  controls: `[data-permission="visibility"]` and `[data-permission="download"]`.
  Fires `[data-strike]` once.

- [ ] **Step 5: Style the completion surface**

Append to `apps/extension/popup/popup.css`:

```css
.sr-spine { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; }
.sr-spine-col { display: flex; flex-direction: column; gap: 6px; }
.sr-spine-track { position: relative; height: 3px; background: var(--sr-border-dark); }
.sr-spine-track > [data-spine-segment] { position: absolute; left: 0; top: 0; bottom: 0;
  transition: width var(--sr-dur-slow) var(--sr-ease); }
[data-spine-segment][data-treatment="done"]   { background: var(--sr-green); }
[data-spine-segment][data-treatment="active"] { background: var(--sr-cyan); }
[data-spine-segment][data-treatment="failed"] { background: var(--sr-coral-text); }
[data-spine-segment][data-treatment="pending"]{ background: transparent; }
[data-spine-segment][data-treatment="dashed"] { background: transparent; width: 100%;
  background-image: repeating-linear-gradient(90deg,
    var(--sr-text-faint-on-dark) 0 5px, transparent 5px 10px); }
[data-spine-break] { position: absolute; top: -3px; width: 2px; height: 9px;
  background: var(--sr-coral-text); }
[data-spine-node] { width: 7px; height: 7px; border: 1px solid var(--sr-border-dark); }
[data-spine-node][data-state="done"]    { background: var(--sr-green); border-color: var(--sr-green); }
[data-spine-node][data-state="current"] { border-color: var(--sr-cyan); }
.sr-spine-label { font-family: var(--sr-font-mono); font-size: 9px;
  color: var(--sr-text-faint-on-dark); }

.sr-edge-rail { display: flex; flex-direction: column; }
.sr-edge-rail button { flex: 1; border: none; background: transparent; cursor: pointer;
  color: var(--sr-text-secondary-on-dark); display: flex; align-items: center;
  justify-content: center; padding: 10px 0;
  border-bottom: 1px solid var(--sr-border-dark-soft); }
.sr-edge-rail button:last-child { border-bottom: none; }
.sr-edge-rail button[data-tone="cyan"] { color: var(--sr-cyan); }
.sr-edge-rail button[data-destructive]:hover { background: #2A1512; color: var(--sr-coral-on-dark); }
.sr-edge-rail button[aria-disabled="true"] { color: var(--sr-text-faint-on-dark); cursor: not-allowed; }
```

> The `#2A1512` above is the one hex literal permitted in this file — it is a
> destructive-hover wash with no token. If you add more, add tokens instead.
> **Better:** add `--sr-coral-wash-dark: #2A1512` to `tokens.css` and the
> extension copy, and use it. Do that.

- [ ] **Step 6: Run the tests**

Run: `npm run test --workspace=apps/extension`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add apps/extension/popup apps/extension/styles packages/design-system/src/tokens.css apps/extension/__tests__
git commit -m "feat(ext): add the capture completion surface B1-B6"
```

---

## Task 7: The offline upload queue

**Files:**
- Create: `apps/extension/background/queue.js`
- Create: `apps/extension/__tests__/queue.test.js`
- Modify: `apps/extension/background/background.js`
- Modify: `apps/extension/manifest.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```js
  // background/queue.js — pure reducers over a queue array
  export function enqueue(queue, item)             // → queue
  export function markUploading(queue, id, pct)    // → queue
  export function markFailed(queue, id, reason, at)// → queue
  export function markDone(queue, id, url)         // → queue
  export function nextPending(queue)               // → item | null
  export function backoffMs(attempts)              // → number
  export function prune(queue, nowMs, maxAgeMs)    // → queue
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/extension/__tests__/queue.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { enqueue, markUploading, markFailed, markDone, nextPending, backoffMs, prune } from '../background/queue.js';

const item = (id, at = 1000) => ({ id, fileName: `${id}.webm`, bytes: 7_200_000, createdAt: at });

describe('offline upload queue', () => {
  it('queues a capture without losing it', () => {
    const q = enqueue([], item('c1'));
    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('pending');
    expect(q[0].attempts).toBe(0);
  });

  it('never enqueues the same capture twice', () => {
    const q = enqueue(enqueue([], item('c1')), item('c1'));
    expect(q).toHaveLength(1);
  });

  it('resumes from the recorded offset rather than restarting', () => {
    let q = enqueue([], item('c1'));
    q = markUploading(q, 'c1', 62);
    q = markFailed(q, 'c1', 'network', 62);
    expect(q[0].status).toBe('pending');
    expect(q[0].offsetPct).toBe(62);
    expect(q[0].attempts).toBe(1);
  });

  it('backs off exponentially, capped at fifteen minutes', () => {
    expect(backoffMs(0)).toBe(30_000);
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(10)).toBe(900_000);
  });

  it('serves the oldest pending item first', () => {
    let q = enqueue(enqueue([], item('c1', 1000)), item('c2', 2000));
    expect(nextPending(q).id).toBe('c1');
    q = markDone(q, 'c1', 'https://x');
    expect(nextPending(q).id).toBe('c2');
  });

  it('does not serve an item that is already uploading', () => {
    const q = markUploading(enqueue([], item('c1')), 'c1', 10);
    expect(nextPending(q)).toBeNull();
  });

  it('keeps a completed item long enough for the popup to show its link', () => {
    const q = markDone(enqueue([], item('c1')), 'c1', 'https://x');
    expect(q[0].status).toBe('done');
    expect(q[0].url).toBe('https://x');
  });

  it('prunes completed items after the retention window, never pending ones', () => {
    let q = enqueue(enqueue([], item('c1', 0)), item('c2', 0));
    q = markDone(q, 'c1', 'https://x');
    const pruned = prune(q, 86_400_001, 86_400_000);
    expect(pruned.map(i => i.id)).toEqual(['c2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/extension -- queue`
Expected: FAIL — cannot resolve `../background/queue.js`.

- [ ] **Step 3: Write the implementation**

Create `apps/extension/background/queue.js`:

```js
/** The offline upload queue.
 *
 * Pure reducers over an array. The service worker owns persistence
 * (chrome.storage.local) and the alarm; this file owns the rules. Keeping them
 * apart is what makes "closing the window does not stop the upload" testable.
 *
 * NOTE: background/*.js are classic scripts sharing one global scope, loaded by
 * importScripts. This file uses ESM syntax only so Vitest can import it; the
 * build step in background.js re-exposes it on globalThis. See the footer. */

const MAX_BACKOFF_MS = 900_000; // 15 minutes

export function enqueue(queue, item) {
  if (queue.some(i => i.id === item.id)) return queue;
  return [...queue, { ...item, status: 'pending', attempts: 0, offsetPct: 0, url: null, reason: null }];
}

const patch = (queue, id, fields) => queue.map(i => (i.id === id ? { ...i, ...fields } : i));

export function markUploading(queue, id, pct) {
  return patch(queue, id, { status: 'uploading', offsetPct: pct });
}

export function markFailed(queue, id, reason, at) {
  return queue.map(i =>
    i.id === id
      ? { ...i, status: 'pending', reason, offsetPct: at ?? i.offsetPct, attempts: i.attempts + 1 }
      : i);
}

export function markDone(queue, id, url) {
  return patch(queue, id, { status: 'done', url, reason: null, offsetPct: 100 });
}

export function nextPending(queue) {
  return queue
    .filter(i => i.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
}

export function backoffMs(attempts) {
  return Math.min(30_000 * 2 ** attempts, MAX_BACKOFF_MS);
}

/** Completed items are kept so the popup can still show their link. Pending
 * items are never pruned — a queued capture is the user's only copy of work
 * they may have closed the tab on. */
export function prune(queue, nowMs, maxAgeMs) {
  return queue.filter(i => i.status !== 'done' || nowMs - i.createdAt < maxAgeMs);
}
```

- [ ] **Step 4: Expose it to the service worker**

`importScripts` loads classic scripts, where `export` is a syntax error — so the
tested module and the loaded script must be two files. Keep them in lockstep with
a drift test rather than trusting discipline.

**4a.** Rename what you just wrote to `apps/extension/background/queue.core.js`
and update the test's import path to `../background/queue.core.js`. This is the
ESM module; only the test loads it.

**4b.** Create `apps/extension/background/queue.js` — the classic script the
service worker loads. Same function bodies, declared with plain `function`, no
`export` keyword, and this footer instead:

```js
// Loaded by importScripts into the service worker's global scope.
// Mirrors background/queue.core.js — see __tests__/queue.test.js, which fails
// if the two drift.
globalThis.SnapRecQueue = {
  enqueue, markUploading, markFailed, markDone, nextPending, backoffMs, prune,
};
```

**4c.** Add the drift test to `apps/extension/__tests__/queue.test.js`:

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

it('the classic-script copy has not drifted from the tested module', () => {
  const normalise = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')                 // block comments
    .replace(/^\s*(export\s+)?/gm, '')                 // export keyword + indent
    .replace(/export\s*\{[^}]*\};?/g, '')              // trailing export block
    .replace(/globalThis\.SnapRecQueue[\s\S]*$/, '')   // the classic footer
    .replace(/\s+/g, ' ')
    .trim();

  const core = readFileSync(resolve(__dirname, '../background/queue.core.js'), 'utf8');
  const classic = readFileSync(resolve(__dirname, '../background/queue.js'), 'utf8');
  expect(normalise(classic)).toBe(normalise(core));
});
```

- [ ] **Step 5: Wire it into the service worker**

In `apps/extension/background/background.js`, add `queue.js` to the
`importScripts` list **after** `config.js`, and add:

```js
const QUEUE_KEY = 'snaprecUploadQueue';
const DRAIN_ALARM = 'snaprec-drain-queue';

async function readQueue() {
  const { [QUEUE_KEY]: q = [] } = await chrome.storage.local.get(QUEUE_KEY);
  return q;
}
async function writeQueue(q) {
  await chrome.storage.local.set({ [QUEUE_KEY]: q });
}

/** Queue a capture instead of failing it. Closing the popup or the tab must not
 * stop or lose the upload — that promise is the whole reason this exists. */
async function queueCapture(item) {
  await writeQueue(SnapRecQueue.enqueue(await readQueue(), item));
  chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0.5 });
}

async function drainQueue() {
  let q = SnapRecQueue.prune(await readQueue(), Date.now(), 86_400_000);
  const next = SnapRecQueue.nextPending(q);
  if (!next) { await writeQueue(q); return; }

  if (!navigator.onLine) {
    chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 1 });
    await writeQueue(q);
    return;
  }

  q = SnapRecQueue.markUploading(q, next.id, next.offsetPct);
  await writeQueue(q);

  try {
    const url = await uploadCapture(next, pct =>
      chrome.runtime.sendMessage({ type: 'UPLOAD_PROGRESS', id: next.id, pct }).catch(() => {}));
    await writeQueue(SnapRecQueue.markDone(await readQueue(), next.id, url));
    chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0.05 });
  } catch (err) {
    const failed = SnapRecQueue.markFailed(await readQueue(), next.id, String(err), next.offsetPct);
    await writeQueue(failed);
    const attempts = failed.find(i => i.id === next.id).attempts;
    chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: SnapRecQueue.backoffMs(attempts) / 60_000 });
  }
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === DRAIN_ALARM) drainQueue(); });
self.addEventListener('online', () => chrome.alarms.create(DRAIN_ALARM, { delayInMinutes: 0 }));
```

- [ ] **Step 6: Add the alarms permission**

In `apps/extension/manifest.json`, add `"alarms"` to the `permissions` array.

- [ ] **Step 7: Run the tests**

Run: `npm run test --workspace=apps/extension`
Expected: PASS, all suites.

- [ ] **Step 8: Verify offline behaviour in Chrome**

1. Load unpacked, sign in, record a 10-second capture.
2. Before uploading: DevTools → Network → Offline.
3. Click "Upload and get link". The popup shows B4 (queued, dashed, no coral).
4. Close the popup. Go back online.
5. Reopen the popup within a minute — it shows B6 with a working link.
6. `chrome.storage.local.get('snaprecUploadQueue')` in the service-worker console
   shows the item marked `done`.

- [ ] **Step 9: Commit**

```bash
git add apps/extension/background apps/extension/manifest.json apps/extension/__tests__
git commit -m "feat(ext): queue uploads offline and drain them in the service worker"
```

---

## Task 8: Wire the popup to Chrome

**Files:**
- Rewrite: `apps/extension/popup/popup.js`
- Modify: `apps/extension/background/storage.js`

**Interfaces:**
- Consumes: `initialState`, `transition`, `render`, `SnapRecQueue`.
- Produces: the running popup.

- [ ] **Step 1: Write popup.js**

```js
import { initialState, transition, derive } from './state.js';
import { render } from './render.js';

let state = initialState();
let timer = null;

function dispatch(event) {
  const next = transition(state, event);
  if (next === state) return;
  state = next;
  render(state, dispatch);
  afterRender();
  runSideEffects(event);
}

/** Focus management the state machine cannot own, because it has no DOM. */
function afterRender() {
  const target = document.querySelector('[data-focus-target]');
  if (target) target.focus();

  const d = derive(state);
  clearInterval(timer);
  if (state.view === 'countdown' || state.view === 'recording') {
    timer = setInterval(() => dispatch({ type: 'TICK' }), 1000);
  }
  if (d.strikesCorners) {
    // Restart the animation without a reflow hack: the class is applied fresh
    // on every render, so the keyframe runs once per entry into the view.
  }
}

function runSideEffects(event) {
  switch (event.type) {
    case 'START':
      chrome.runtime.sendMessage({ type: 'PREPARE_CAPTURE', config: {
        mode: state.mode, source: state.source, inputs: state.inputs, options: state.options,
      } });
      break;
    case 'STOP':
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
      break;
    case 'UPLOAD':
      chrome.runtime.sendMessage({ type: 'UPLOAD_CAPTURE', id: state.capture.id });
      break;
    case 'CANCEL':
      if (state.view === 'complete') chrome.runtime.sendMessage({ type: 'CANCEL_UPLOAD', id: state.capture.id });
      break;
  }
}

chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'CAPTURE_FINISHED': dispatch({ type: 'FINISHED', capture: msg.capture }); break;
    case 'UPLOAD_PROGRESS':  dispatch({ type: 'UPLOAD_PROGRESS', pct: msg.pct, bytes: msg.bytes }); break;
    case 'UPLOAD_FAILED':    dispatch({ type: 'UPLOAD_FAILED', reason: msg.reason, at: msg.at }); break;
    case 'UPLOAD_QUEUED':    dispatch({ type: 'OFFLINE' }); break;
    case 'UPLOAD_SAVED':     dispatch({ type: 'SAVED' }); break;
    case 'LINK_READY':       dispatch({ type: 'LINK_READY', url: msg.url }); break;
    case 'PERMISSION_REQUIRED': dispatch({ type: 'PERMISSION_REQUIRED', input: msg.input }); break;
    case 'PERMISSION_DENIED':   dispatch({ type: 'PERMISSION_DENIED', input: msg.input }); break;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (state.view === 'countdown' || state.view === 'uploading')) {
    dispatch({ type: 'CANCEL' });
  }
});

// Restore the live state — the popup is closed and reopened constantly and must
// never show `ready` while a recording is running.
chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATE' }, restored => {
  if (restored) { state = { ...state, ...restored }; }
  render(state, dispatch);
  afterRender();
});
```

- [ ] **Step 2: Make the upload resumable**

In `apps/extension/background/storage.js`, change the R2 PUT to report progress
and accept a starting offset:

```js
/** Resume from `offsetPct` rather than restarting. R2 presigned PUTs do not
 * support ranged resume, so a partial upload restarts the transfer but the
 * *user-facing* progress resumes from where it stopped — the file is small
 * enough that re-sending is cheaper than multipart bookkeeping. Revisit if
 * captures routinely exceed 100 MB. */
async function uploadToR2(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), e.loaded);
    });
    xhr.addEventListener('load', () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`))));
    xhr.addEventListener('error', () => reject(new Error('network')));
    xhr.addEventListener('abort', () => reject(new Error('cancelled')));
    xhr.send(blob);
  });
}
```

`fetch` has no upload-progress event, which is why this uses `XMLHttpRequest`.
Do not "modernise" it back to `fetch` — the B2 byte counter depends on it.

- [ ] **Step 3: Verify in Chrome**

Full path: open popup → start recording → countdown → recording → pause → resume
→ stop → finishing → complete → upload → link ready → copy link → open the link
in a new tab and confirm it plays.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/popup/popup.js apps/extension/background/storage.js
git commit -m "feat(ext): wire the popup state machine to the service worker"
```

---

## Task 9: Permission page and FAB

**Files:**
- Modify: `apps/extension/permission/permission.html`
- Modify: `apps/extension/content/fab.css`

- [ ] **Step 1: Restyle the permission page**

Link `../styles/design-system.css`, replace every hardcoded colour with a
`var(--sr-*)`, apply the A4/A5 copy rules: what happened, what still works,
three concrete steps. No apology, no API names.

- [ ] **Step 2: Restyle the FAB**

`fab.css` is injected on all URLs, so it cannot read `--sr-*`. Use the same
`all: initial` reset as the recording bar, hex literals mirroring the tokens with
a comment naming each one, and a 44px hit area.

- [ ] **Step 3: Verify**

Load unpacked. The FAB appears on `example.com` and on a dark site, is not
overridden by page CSS, and is keyboard-reachable.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/permission apps/extension/content/fab.css
git commit -m "feat(ext): restyle the permission page and FAB on the plate"
```

---

## Task 10: Delete the dead popup code

**Files:**
- Delete: `apps/extension/dist/popup/index.html` (stale build artefact)
- Modify: `.gitignore`

- [ ] **Step 1: Confirm it is dead**

```bash
grep -rn "dist/popup" apps/extension --include=*.json --include=*.js
```

Expected: no hits outside the file itself. If `manifest.json` points at it, stop
and fix the manifest instead.

- [ ] **Step 2: Delete and ignore**

```bash
git rm -r apps/extension/dist
echo "apps/extension/dist/" >> .gitignore
```

- [ ] **Step 3: Verify the extension still loads**

Reload unpacked. No errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/extension .gitignore
git commit -m "chore(ext): remove the stale dist/popup artefact"
```

---

## Task 11: Ship

**Files:**
- Modify: `apps/extension/background/config.js` (swap back to production)
- Modify: `apps/web/public/version.json`

- [ ] **Step 1: Confirm config points at production**

```bash
grep -n "localhost\|API_BASE_URL\|WEB_BASE_URL" apps/extension/background/config.js
```

Every localhost line must be commented out. If not, this task fails.

- [ ] **Step 2: Run every check**

```bash
npm run test --workspace=apps/extension
npm test --workspace=packages/design-system
```

Expected: all PASS.

- [ ] **Step 3: Package**

```bash
./ship-to-store.sh
```

Expected: `apps/snaprec-extension-v<version>.zip` written; `version.json`,
`package.json` and `manifest.json` all carrying the same new version.

- [ ] **Step 4: Bump the web-side version file**

`apps/web/public/version.json` currently lags the extension (1.2.7 vs 1.3.3).
The service worker polls it every 30 minutes to nag users about updates, so it
must match the version that is **live on the store** — set it to the new version
only once the store listing has published, not at package time.

Record the pending version in the commit message so the follow-up is not lost:

```bash
git add apps/extension package.json apps/extension/manifest.json
git commit -m "chore(ext): package v<version>

apps/web/public/version.json still reads <old>. Bump it to <version> and deploy
the web app once the store listing goes live."
```

---

## Exit criteria

- `npm run test --workspace=apps/extension` — all suites pass.
- Extension loads unpacked with no console errors.
- All nine popup states (A1–A9) reachable by interaction alone.
- A real recording completes B1 → B2 → B6 against the dev server.
- An airplane-mode recording shows B4, survives closing the popup, and drains
  to B6 once online.
- `./ship-to-store.sh` produces a valid zip with synchronised versions.
- `background/config.js` points at production.
