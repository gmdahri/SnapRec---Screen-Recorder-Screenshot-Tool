# Camera Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable camera-only and locally composited screen-plus-camera recording while preserving SnapRec's existing screen-only, screenshot, download, editor, upload, and sharing flows.

**Architecture:** Keep screen-only capture on the current direct `MediaStream` path. Camera-only and combined recordings acquire final media in the MV3 offscreen document, render video through a canvas compositor, mix microphone and optional system audio locally, and pass one stream to the existing `MediaRecorder` and blob pipeline. The popup owns temporary camera preview and pre-recording placement; the background service worker remains the lifecycle coordinator.

**Tech Stack:** Manifest V3 Chrome extension, plain JavaScript ES modules, Chrome offscreen documents, `getDisplayMedia`, `getUserMedia`, Canvas 2D, Web Audio API, `MediaRecorder`, Vitest 3, jsdom.

## Global Constraints

- Follow the approved design in `docs/superpowers/specs/2026-08-11-camera-recording-design.md`.
- Reuse existing SnapRec components, typography, spacing, corner treatments, and `--sr-*` design tokens.
- Design-system components must not add hard-coded hex colors or `dark:` utilities.
- Screen-only recording and every screenshot mode must remain unchanged.
- Camera placement is editable before recording and fixed during recording in V1.
- Preview is mirrored; saved camera video is not mirrored.
- All media processing remains local until the user explicitly requests upload or sharing.
- No server, viewer, editor-media-format, or standalone marketing-page changes are in scope.
- Commit each completed task on `feat/camera-recording` after its task review passes. Do not push the branch.

## File Structure

**Create**

- `apps/extension/shared/camera-layout.js` — normalized camera layout defaults, clamping, movement, resizing, and pixel conversion.
- `apps/extension/shared/recording-options.js` — canonical recording request normalization and legacy `tabAudio` migration.
- `apps/extension/popup/camera-preview.js` — temporary popup camera stream lifecycle.
- `apps/extension/offscreen/compositor.js` — pure geometry plus the canvas render loop.
- `apps/extension/offscreen/audio-mixer.js` — microphone/system-audio mixing and mute control.
- `apps/extension/offscreen/media-session.js` — final media acquisition, source-loss policy, and idempotent cleanup.
- `apps/extension/offscreen/recorder.js` — testable `MediaRecorder` and recording-blob lifecycle.
- `apps/extension/tests/cameraLayout.test.js`
- `apps/extension/tests/recordingOptions.test.js`
- `apps/extension/tests/cameraPreview.test.js`
- `apps/extension/tests/compositor.test.js`
- `apps/extension/tests/audioMixer.test.js`
- `apps/extension/tests/mediaSession.test.js`
- `apps/extension/tests/offscreenRecorder.test.js`
- `apps/extension/tests/recordingCoordinator.test.js`

**Modify**

- `apps/extension/popup/state.js` — add camera source, layout, FPS, warnings, and fallback events.
- `apps/extension/popup/render.js` — render source-specific inputs, camera preview/placement, warnings, and live microphone control.
- `apps/extension/popup/popup.js` — own preview side effects, persistence, request serialization, and live mute.
- `apps/extension/popup/popup.css` — style new elements with existing design tokens.
- `apps/extension/offscreen/offscreen.html` — load the recorder as an ES module.
- `apps/extension/offscreen/offscreen.js` — delegate acquisition/composition/mixing to the new modules while preserving blob APIs.
- `apps/extension/background/background.js` — coordinate camera-only preparation, configurable countdown, warnings, fallback, and recovery.
- `apps/extension/content/content.js` — retain recording controls but stop opening a second camera stream.
- `apps/extension/background/utils/contentScriptManager.js` — stop injecting the obsolete webcam runtime.
- `apps/extension/manifest.json` — remove obsolete webcam resources after replacement tests pass.
- `apps/extension/tests/state.test.js`
- `apps/extension/tests/render.test.js`
- `apps/extension/tests/webcamOverlay.test.js` — replace old in-page camera ownership assertions with no-second-stream assertions.

**Delete after Task 8 replacement tests pass**

- `apps/extension/content/webcam.js`
- `apps/extension/content/webcam.core.js`
- `apps/extension/tests/webcam.test.js`

---

### Task 1: Canonical recording options and camera layout

**Files:**

- Create: `apps/extension/shared/camera-layout.js`
- Create: `apps/extension/shared/recording-options.js`
- Create: `apps/extension/tests/cameraLayout.test.js`
- Create: `apps/extension/tests/recordingOptions.test.js`
- Modify: `apps/extension/popup/state.js`
- Modify: `apps/extension/tests/state.test.js`

**Interfaces:**

- Produces `DEFAULT_CAMERA_LAYOUT`, `normalizeCameraLayout(layout)`, `moveCameraLayout(layout, dx, dy)`, `resizeCameraLayout(layout, delta)`, and `cameraLayoutPixels(layout, outputWidth, outputHeight)`.
- Produces `normalizeRecordingOptions(raw)` returning `{ source, microphone, systemAudio, camera, cameraLayout, resolution, fps, countdown, autoZoom, cursor }`.
- Produces popup events `SET_CAMERA_LAYOUT`, `CAMERA_WARNING`, `CLEAR_CAMERA_WARNING`, `CONTINUE_WITHOUT_CAMERA`, and `SET_MIC_MUTED`.
- Consumed by Tasks 2–7; do not introduce a second layout or request shape elsewhere.

- [ ] **Step 1: Write failing layout and options tests**

```js
// apps/extension/tests/cameraLayout.test.js
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA_LAYOUT, cameraLayoutPixels, moveCameraLayout,
  normalizeCameraLayout, resizeCameraLayout,
} from '../shared/camera-layout.js';

describe('camera layout', () => {
  it('normalizes invalid persisted values', () => {
    expect(normalizeCameraLayout({ shape: 'hexagon', centerX: 2, centerY: -1, width: 0.9 }))
      .toEqual(DEFAULT_CAMERA_LAYOUT);
  });

  it('clamps movement and width', () => {
    const moved = moveCameraLayout(DEFAULT_CAMERA_LAYOUT, 2, 2);
    expect(moved.centerX).toBe(1);
    const pixels = cameraLayoutPixels(moved, 1920, 1080);
    expect(pixels.x + pixels.width).toBeLessThanOrEqual(1920);
    expect(resizeCameraLayout(DEFAULT_CAMERA_LAYOUT, 1).width).toBe(0.32);
    expect(resizeCameraLayout(DEFAULT_CAMERA_LAYOUT, -1).width).toBe(0.12);
  });

  it('turns normalized circle placement into square pixels', () => {
    const px = cameraLayoutPixels({ shape: 'circle', centerX: .5, centerY: .5, width: .2 }, 1920, 1080);
    expect(px).toEqual({ shape: 'circle', x: 768, y: 348, width: 384, height: 384 });
  });
});
```

```js
// apps/extension/tests/recordingOptions.test.js
import { describe, expect, it } from 'vitest';
import { normalizeRecordingOptions } from '../shared/recording-options.js';

describe('recording options', () => {
  it('migrates tabAudio and makes camera mandatory for camera-only', () => {
    const options = normalizeRecordingOptions({
      source: 'camera', inputs: { mic: true, tabAudio: true, camera: false },
    });
    expect(options).toMatchObject({
      source: 'camera', microphone: true, systemAudio: false, camera: true,
    });
  });

  it('keeps system audio optional for display sources', () => {
    expect(normalizeRecordingOptions({
      source: 'window', inputs: { mic: false, systemAudio: true, camera: true },
    })).toMatchObject({ source: 'window', microphone: false, systemAudio: true, camera: true });
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test --workspace=apps/extension -- cameraLayout recordingOptions`

Expected: FAIL because `shared/camera-layout.js` and `shared/recording-options.js` do not exist.

- [ ] **Step 3: Implement the shared contracts**

```js
// apps/extension/shared/camera-layout.js
export const DEFAULT_CAMERA_LAYOUT = Object.freeze({
  shape: 'circle', centerX: 0.88, centerY: 0.82, width: 0.18,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeCameraLayout(value = {}) {
  const shape = value.shape;
  const centerX = Number(value.centerX);
  const centerY = Number(value.centerY);
  const width = Number(value.width);
  if (!['circle', 'rounded'].includes(shape)
      || !Number.isFinite(centerX) || centerX < 0 || centerX > 1
      || !Number.isFinite(centerY) || centerY < 0 || centerY > 1
      || !Number.isFinite(width) || width < 0.12 || width > 0.32) {
    return { ...DEFAULT_CAMERA_LAYOUT };
  }
  return { shape, centerX, centerY, width };
}

export function cameraLayoutPixels(layout, outputWidth, outputHeight) {
  const safe = normalizeCameraLayout(layout);
  const width = Math.round(safe.width * outputWidth);
  const height = safe.shape === 'circle' ? width : Math.round(width * 9 / 16);
  const halfX = width / (2 * outputWidth);
  const halfY = height / (2 * outputHeight);
  const centerX = clamp(safe.centerX, halfX, 1 - halfX);
  const centerY = clamp(safe.centerY, halfY, 1 - halfY);
  return {
    shape: safe.shape,
    x: Math.round(centerX * outputWidth - width / 2),
    y: Math.round(centerY * outputHeight - height / 2),
    width,
    height,
  };
}

export const moveCameraLayout = (layout, dx, dy) => {
  const safe = normalizeCameraLayout(layout);
  return normalizeCameraLayout({
    ...safe,
    centerX: clamp(safe.centerX + dx, 0, 1),
    centerY: clamp(safe.centerY + dy, 0, 1),
  });
};

export const resizeCameraLayout = (layout, delta) => {
  const safe = normalizeCameraLayout(layout);
  return { ...safe, width: clamp(safe.width + delta, 0.12, 0.32) };
};
```

Implement `normalizeRecordingOptions(raw)` using the exact return shape in Interfaces. Resolve system audio with `raw.inputs?.systemAudio ?? raw.inputs?.tabAudio ?? true`, force `camera: true` and `systemAudio: false` when `source === 'camera'`, normalize layout through `normalizeCameraLayout`, and parse FPS/countdown as numbers.

- [ ] **Step 4: Extend popup state through the canonical contract**

Update `initialState()` to include `inputs.systemAudio`, `cameraLayout`, `options.fps: 30`, `warning: null`, `decisionRequired: false`, `micMuted: false`, and `hasMicrophoneTrack: false`. Add pure transitions:

```js
case 'SET_SOURCE':
  return set(state, {
    source: event.source,
    inputs: event.source === 'camera'
      ? { ...state.inputs, camera: true, systemAudio: false }
      : state.inputs,
  });
case 'SET_CAMERA_LAYOUT':
  return set(state, { cameraLayout: normalizeCameraLayout(event.layout) });
case 'CAMERA_WARNING': {
  const blockingCameraOnly = state.source === 'camera' && !event.decisionRequired;
  return set(state, {
    warning: event.warning,
    decisionRequired: !!event.decisionRequired,
    pendingPermission: event.decisionRequired || blockingCameraOnly ? 'camera' : state.pendingPermission,
    returnTo: event.decisionRequired || blockingCameraOnly ? state.view : state.returnTo,
    view: event.decisionRequired ? 'permission' : blockingCameraOnly ? 'denied' : state.view,
  });
}
case 'CLEAR_CAMERA_WARNING':
  return set(state, { warning: null, decisionRequired: false });
case 'CONTINUE_WITHOUT_CAMERA':
  return set(state, {
    warning: null,
    decisionRequired: false,
    pendingPermission: null,
    inputs: { ...state.inputs, camera: false },
    view: 'arming',
  });
case 'SET_MIC_MUTED':
  return set(state, { micMuted: !!event.muted });
```

Update `derive(state)` with `isCameraOnly`, `showsSystemAudio`, `showsCameraToggle`, and `needsCamera`. Camera-only must show microphone, hide system audio, and hide the camera toggle.

- [ ] **Step 5: Add state regression assertions and run them**

```js
it('makes camera-only explicit and removes irrelevant inputs', () => {
  const s = transition(initialState(), { type: 'SET_SOURCE', source: 'camera' });
  expect(s.inputs.camera).toBe(true);
  expect(s.inputs.systemAudio).toBe(false);
  expect(derive(s)).toMatchObject({
    isCameraOnly: true, showsSystemAudio: false, showsCameraToggle: false, needsCamera: true,
  });
});

it('stores a real frame rate', () => {
  const s = transition(initialState(), { type: 'SET_OPTION', key: 'fps', value: '60' });
  expect(s.options.fps).toBe(60);
});
```

Run: `npm test --workspace=apps/extension -- cameraLayout recordingOptions state`

Expected: PASS.

- [ ] **Step 6: Commit for task review**

Run: `git diff --check -- apps/extension/shared apps/extension/popup/state.js apps/extension/tests`

Expected: no whitespace errors. Confirm only Task 1 files changed, then commit them with `feat(extension): add camera recording contracts` for task review.

---

### Task 2: Source-specific popup UI and real recording options

**Files:**

- Modify: `apps/extension/popup/render.js`
- Modify: `apps/extension/popup/popup.css`
- Modify: `apps/extension/tests/render.test.js`

**Interfaces:**

- Consumes `derive(state)`, `state.cameraLayout`, and `state.options.fps` from Task 1.
- Produces DOM hooks `[data-camera-preview]`, `[data-camera-bubble]`, `[data-camera-resize]`, `[data-camera-shape]`, `[data-live-mic]`, and `[data-warning]`.
- Produces keyboard/pointer DOM hooks that dispatch `SET_CAMERA_LAYOUT`; Task 3 owns their side effects and persistence.

- [ ] **Step 1: Write failing render tests for the four-source UI**

```js
it('offers camera as a fourth recording source', () => {
  const root = mount(initialState());
  expect([...root.querySelectorAll('[data-source]')].map((el) => el.dataset.source))
    .toEqual(['tab', 'window', 'screen', 'camera']);
});

it('camera-only shows a full camera frame, mic, and no irrelevant switches', () => {
  const camera = transition(initialState(), { type: 'SET_SOURCE', source: 'camera' });
  const root = mount(camera);
  expect(root.querySelector('[data-camera-preview]')).toBeTruthy();
  expect(root.querySelector('[data-control="mic"]')).toBeTruthy();
  expect(root.querySelector('[data-control="systemAudio"]')).toBeNull();
  expect(root.querySelector('[data-control="camera"]')).toBeNull();
});

it('combined mode renders an editable bubble in the source thumbnail', () => {
  const combined = transition(initialState(), { type: 'TOGGLE_INPUT', input: 'camera' });
  const root = mount(combined);
  expect(root.querySelector('[data-camera-bubble][tabindex="0"]')).toBeTruthy();
  expect(root.querySelector('[data-camera-resize]')).toBeTruthy();
});

it('uses the selected fps in the options view', () => {
  const state = transition(
    { ...initialState(), options: { ...initialState().options, fps: 60 } },
    { type: 'OPEN_OPTIONS' },
  );
  expect(mount(state).querySelector('[data-option="fps"][aria-checked="true"]').textContent).toBe('60');
});
```

- [ ] **Step 2: Run the render suite and verify the new assertions fail**

Run: `npm test --workspace=apps/extension -- render`

Expected: FAIL because Camera source and camera preview hooks are absent and FPS is fixed at 30.

- [ ] **Step 3: Render sources and inputs without duplicating views**

Extend `SOURCES` with `['camera', 'Camera', 'user']`. In `viewReady`, use the derived flags:

```js
function recordingInputs(state, d) {
  return `
    <div class="sr-inputs">
      ${inputRow(state, 'mic', 'Microphone', 'audio', state.micDevice ?? '')}
      ${d.showsSystemAudio ? inputRow(state, 'systemAudio', 'System audio', 'sound', '') : ''}
      ${d.showsCameraToggle ? inputRow(state, 'camera', 'Camera', 'user', state.inputs.camera ? '' : 'off') : ''}
    </div>`;
}
```

Refactor `preview(state)` so camera-only renders a full `<video muted playsinline data-camera-preview>`, combined mode renders the same video inside `[data-camera-bubble]`, and screen-only retains the existing still image. Set normalized values through CSS custom properties, not inline colors.

- [ ] **Step 4: Make placement and warnings accessible**

Give the bubble `tabindex="0"`, `role="group"`, and an `aria-label` that names drag and keyboard controls. Render a real button for shape and a real button/handle for resize. Render `state.warning` through the existing notice language and `[data-warning]`, using a status word in addition to color.

When `state.pendingPermission === 'camera' && state.decisionRequired`, the permission view's secondary action is `[data-action="continue-without-camera"]` and dispatches `CONTINUE_WITHOUT_CAMERA`. Other permission inputs retain the existing `[data-action="proceed-without"]` behavior.

In live Recording and Paused views, render the microphone row only when `state.inputs.mic` or the active session reports a microphone track:

```js
${state.hasMicrophoneTrack
  ? `<button type="button" class="sr-live-mic" data-live-mic aria-pressed="${state.micMuted}">
       ${icon('audio', 13)}${state.micMuted ? 'Unmute microphone' : 'Mute microphone'}
     </button>`
  : ''}
```

- [ ] **Step 5: Add token-only styles and run render/tokens tests**

Add `.sr-camera-preview`, `.sr-camera-bubble`, `.sr-camera-resize`, `.sr-camera-shape`, and `.sr-live-mic` styles using only `var(--sr-*)` color values. The camera-only frame remains `aspect-ratio: 16 / 9`; the bubble uses custom properties for `left`, `top`, and `width`; the inner video alone is mirrored.

Run: `npm test --workspace=apps/extension -- render tokens`

Expected: PASS, including the existing “exactly six controls” rule for the default display-source ready state.

- [ ] **Step 6: Commit for task review**

Run: `git diff --check -- apps/extension/popup apps/extension/tests/render.test.js`

Expected: no whitespace errors. Confirm no hard-coded color was added to `popup.css`, then commit with `feat(extension): add camera recording controls` for task review.

---

### Task 3: Temporary camera preview and placement interactions

**Files:**

- Create: `apps/extension/popup/camera-preview.js`
- Create: `apps/extension/tests/cameraPreview.test.js`
- Modify: `apps/extension/popup/popup.js`
- Modify: `apps/extension/popup/render.js`
- Modify: `apps/extension/tests/render.test.js`

**Interfaces:**

- Produces `createCameraPreview({ mediaDevices })` returning `{ start(), attach(video), stop(), hasStream() }`.
- Consumes `moveCameraLayout`, `resizeCameraLayout`, and `normalizeRecordingOptions` from Task 1.
- Emits only state-machine events from placement handlers; camera APIs remain in `popup.js`/`camera-preview.js`.

- [ ] **Step 1: Write failing preview lifecycle tests**

```js
import { describe, expect, it, vi } from 'vitest';
import { createCameraPreview } from '../popup/camera-preview.js';

it('opens one video-only stream, attaches it, and releases every track', async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  const mediaDevices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
  const preview = createCameraPreview({ mediaDevices });
  await preview.start();
  const video = { srcObject: null, play: vi.fn().mockResolvedValue() };
  await preview.attach(video);
  expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true, audio: false });
  expect(video.srcObject).toBe(stream);
  preview.stop();
  expect(stop).toHaveBeenCalledOnce();
  expect(video.srcObject).toBeNull();
});

it('reuses an existing preview instead of opening the camera twice', async () => {
  const stream = { getTracks: () => [] };
  const mediaDevices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
  const preview = createCameraPreview({ mediaDevices });
  await Promise.all([preview.start(), preview.start()]);
  expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the preview test and verify it fails**

Run: `npm test --workspace=apps/extension -- cameraPreview`

Expected: FAIL because `popup/camera-preview.js` does not exist.

- [ ] **Step 3: Implement one-owner preview lifecycle**

Implement `createCameraPreview` with one `stream`, one in-flight `starting` promise, and a `Set` of attached video elements. `stop()` must stop all tracks, set every attached element's `srcObject` to `null`, clear the set, and make a later `start()` acquire a fresh stream.

Translate `NotAllowedError` to `{ code: 'camera_permission_denied' }` and `NotReadableError`/`AbortError` to `{ code: 'camera_unavailable' }`; preserve the original error as `cause`.

- [ ] **Step 4: Wire preview side effects into popup lifecycle**

In `popup.js`, create one controller:

```js
const cameraPreview = createCameraPreview({ mediaDevices: navigator.mediaDevices });

async function syncCameraPreview() {
  const needsPreview = state.view === 'ready'
    && (state.source === 'camera' || state.inputs.camera);
  if (!needsPreview) return cameraPreview.stop();
  try {
    await cameraPreview.start();
    await cameraPreview.attach(document.querySelector('[data-camera-preview]'));
    if (state.warning?.startsWith('camera_')) dispatch({ type: 'CLEAR_CAMERA_WARNING' });
  } catch (error) {
    dispatch({ type: 'CAMERA_WARNING', warning: error.code });
  }
}
```

Call `syncCameraPreview()` after each `paint()`. On `START`, call `cameraPreview.stop()` before sending the normalized request. On `unload`, always stop it. Remove popup calls to `setWebcamPreview` and `getWebcamPreview`; the webpage no longer owns preview truth.

Serialize Start through the one canonical function:

```js
const options = normalizeRecordingOptions({
  source: state.source,
  inputs: state.inputs,
  cameraLayout: state.cameraLayout,
  options: state.options,
});
cameraPreview.stop();
send({ action: 'startRecording', options });
```

During `boot()`, read `cameraLayout` from `chrome.storage.local`, normalize it, and place it into state before the first `paint()`. Persist only the normalized contract after a placement or shape event.

- [ ] **Step 5: Bind pointer and keyboard placement**

Use pointer capture on `[data-camera-bubble]`. Convert pointer coordinates to normalized preview coordinates, dispatch `SET_CAMERA_LAYOUT`, and persist `cameraLayout` through `chrome.storage.local`. Keyboard behavior is exact:

```js
const step = event.shiftKey ? 0.02 : 0.005;
if (event.key === 'ArrowLeft') next = moveCameraLayout(state.cameraLayout, -step, 0);
if (event.key === 'ArrowRight') next = moveCameraLayout(state.cameraLayout, step, 0);
if (event.key === 'ArrowUp') next = moveCameraLayout(state.cameraLayout, 0, -step);
if (event.key === 'ArrowDown') next = moveCameraLayout(state.cameraLayout, 0, step);
```

On the resize handle, ArrowUp/ArrowRight increases width and ArrowDown/ArrowLeft decreases it by `0.01` (`0.02` with Shift). Shape toggles only between `circle` and `rounded`.

- [ ] **Step 6: Test dispatch, cleanup, and persistence**

Add render tests that fire keyboard events and assert exact `SET_CAMERA_LAYOUT` events. Add a state regression for deselecting camera and a `cameraPreview` lifecycle assertion that `syncCameraPreview` calls `stop()` when no camera is needed. Run:

Run: `npm test --workspace=apps/extension -- cameraPreview cameraLayout render state`

Expected: PASS.

- [ ] **Step 7: Commit for task review**

Run: `git diff --check -- apps/extension/popup apps/extension/shared apps/extension/tests`

Expected: no whitespace errors. Confirm the preview opens only from a user-selected camera path, then commit with `feat(extension): add camera preview placement` for task review.

---

### Task 4: Canvas compositor and deterministic geometry

**Files:**

- Create: `apps/extension/offscreen/compositor.js`
- Create: `apps/extension/tests/compositor.test.js`

**Interfaces:**

- Produces `OUTPUT_SIZES`, `containRect(sourceWidth, sourceHeight, targetWidth, targetHeight)`, `coverSourceRect(sourceWidth, sourceHeight, targetWidth, targetHeight)`, and `createCompositor(config)`.
- `createCompositor({ canvas, displayVideo, cameraVideo, mode, layout, resolution, fps, schedule, cancel })` returns `{ stream, start(), pause(), resume(), removeCamera(), stop(), effectiveSettings() }`.
- Consumed by `media-session.js` in Task 5.

- [ ] **Step 1: Write failing geometry and render tests**

```js
import { describe, expect, it, vi } from 'vitest';
import {
  OUTPUT_SIZES, containRect, coverSourceRect, createCompositor,
} from '../offscreen/compositor.js';

it('letterboxes a 4:3 screen inside 16:9 output', () => {
  expect(containRect(1024, 768, 1920, 1080))
    .toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
});

it('center-crops a 4:3 camera to 16:9', () => {
  expect(coverSourceRect(1024, 768, 1920, 1080))
    .toEqual({ sx: 0, sy: 96, sw: 1024, sh: 576 });
});

it('draws screen first and clipped camera second', () => {
  const calls = [];
  const context = {
    fillStyle: '', fillRect: (...args) => calls.push(['fillRect', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), clip: vi.fn(),
  };
  const canvas = {
    width: 0, height: 0, getContext: () => context,
    captureStream: vi.fn(() => ({ getVideoTracks: () => [{ getSettings: () => ({ frameRate: 30 }) }] })),
  };
  let drawNextFrame;
  const schedule = vi.fn((callback) => { drawNextFrame = callback; return 7; });
  const compositor = createCompositor({
    canvas,
    displayVideo: { videoWidth: 1920, videoHeight: 1080 },
    cameraVideo: { videoWidth: 1280, videoHeight: 720 },
    mode: 'combined', layout: { shape: 'circle', centerX: .88, centerY: .82, width: .18 },
    resolution: '1080p', fps: 30, schedule, cancel: vi.fn(),
  });
  compositor.start();
  drawNextFrame();
  expect(calls.filter(([name]) => name === 'drawImage')).toHaveLength(2);
  expect(canvas.captureStream).toHaveBeenCalledWith(30);
});
```

- [ ] **Step 2: Run the compositor test and verify it fails**

Run: `npm test --workspace=apps/extension -- compositor`

Expected: FAIL because `offscreen/compositor.js` does not exist.

- [ ] **Step 3: Implement pure geometry**

Define:

```js
export const OUTPUT_SIZES = Object.freeze({
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
});
```

`containRect` scales the entire source into the output and centers letterboxing. `coverSourceRect` returns the centered source crop needed to fill a destination. Both functions round returned coordinates to integers and throw on non-positive dimensions.

- [ ] **Step 4: Implement the render loop**

Use `cameraLayoutPixels` from Task 1. Each frame must:

1. Fill the complete output with opaque black.
2. In `combined`, draw the display with `containRect`.
3. In `combined`, save context, clip circle/rounded path, draw the camera with `coverSourceRect`, and restore.
4. In `camera`, draw the camera full-frame with `coverSourceRect` and no transform.

Create `stream` once with `canvas.captureStream(fps)`. `pause()` cancels scheduling without ending the track; `resume()` restarts; `removeCamera()` makes combined frames screen-only and never freezes the last face frame; `stop()` cancels scheduling and stops the canvas video track.

- [ ] **Step 5: Add mode, shape, and lifecycle tests**

Add assertions for camera-only output, rounded clipping through `roundRect` or an explicit path fallback, unmirrored canvas operations, `removeCamera()`, pause/resume scheduling, stop idempotence, and `effectiveSettings()` reading the canvas track.

Run: `npm test --workspace=apps/extension -- compositor cameraLayout`

Expected: PASS.

- [ ] **Step 6: Commit for task review**

Run: `git diff --check -- apps/extension/offscreen/compositor.js apps/extension/tests/compositor.test.js`

Expected: no whitespace errors. Confirm output dimensions and normalized layout match the design spec, then commit with `feat(extension): add video compositor` for task review.

---

### Task 5: Audio mixer and session-scoped media ownership

**Files:**

- Create: `apps/extension/offscreen/audio-mixer.js`
- Create: `apps/extension/offscreen/media-session.js`
- Create: `apps/extension/tests/audioMixer.test.js`
- Create: `apps/extension/tests/mediaSession.test.js`

**Interfaces:**

- Produces `createAudioMixer({ AudioContextCtor, micStream, systemStream })` returning `{ tracks, setMicMuted(muted), close() }`.
- Produces `createMediaSession(deps)` returning `{ prepare(options), continueWithoutCamera(), pause(), resume(), setMicMuted(muted), cleanup(), sourceFrame(maxWidth) }`.
- `prepare(options)` returns `{ status: 'ready', stream, warnings, effectiveSettings }` or `{ status: 'camera-decision', warning: 'camera_permission_denied' | 'camera_unavailable' }`.
- Consumed by `offscreen.js` in Task 6.

- [ ] **Step 1: Write failing audio behavior tests**

Define deterministic media/audio fakes at the top of `audioMixer.test.js`:

```js
const fakeTrack = (kind) => ({ kind, enabled: true, stop: vi.fn() });
const fakeStream = (...kinds) => {
  const tracks = kinds.map(fakeTrack);
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
  };
};

function fakeAudioGraph() {
  const graph = { sources: [], speakerConnections: 0, closed: vi.fn() };
  class AudioContext {
    constructor() { this.destination = { speaker: true }; this.state = 'running'; }
    createMediaStreamSource(stream) {
      const node = { stream, connect: vi.fn((target) => {
        if (target === this.destination) graph.speakerConnections += 1;
      }), disconnect: vi.fn() };
      graph.sources.push(node);
      return node;
    }
    createGain() {
      return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    }
    createMediaStreamDestination() { return { stream: fakeStream('audio') }; }
    close() { graph.closed(); return Promise.resolve(); }
  }
  graph.AudioContext = AudioContext;
  return graph;
}
```

```js
it('mixes mic and system audio without connecting to speakers', () => {
  const graph = fakeAudioGraph();
  const mixer = createAudioMixer({
    AudioContextCtor: graph.AudioContext,
    micStream: fakeStream('audio'),
    systemStream: fakeStream('audio'),
  });
  expect(graph.sources).toHaveLength(2);
  expect(graph.speakerConnections).toBe(0);
  expect(mixer.tracks).toHaveLength(1);
});

it('mutes through gain without stopping the microphone', () => {
  const mic = fakeStream('audio');
  const mixer = createAudioMixer({
    AudioContextCtor: fakeAudioGraph().AudioContext,
    micStream: mic,
    systemStream: null,
  });
  mixer.setMicMuted(true);
  expect(mic.getAudioTracks()[0].stop).not.toHaveBeenCalled();
});
```

The test helper must expose source connections, a `MediaStreamAudioDestinationNode` with one output track, gain values, and `close()` calls; do not depend on a real browser audio device.

- [ ] **Step 2: Write failing media-session tests**

In `mediaSession.test.js`, import `normalizeRecordingOptions` and define `namedError(name)` plus fakes with this exact injected dependency contract:

```js
const namedError = (name) => Object.assign(new Error(name), { name });
const fakeStreamFrom = (...tracks) => ({
  getTracks: () => tracks,
  getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
  getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
});

function fakeMediaDevices({ cameraError } = {}) {
  const displayTrack = fakeTrack('video');
  const displayAudio = fakeTrack('audio');
  const cameraTrack = fakeTrack('video');
  const micTrack = fakeTrack('audio');
  let videoCalls = 0;
  return {
    allTracks: [displayTrack, displayAudio, cameraTrack, micTrack],
    displayTrack,
    getDisplayMedia: vi.fn(async () => fakeStreamFrom(displayTrack, displayAudio)),
    getUserMedia: vi.fn(async (constraints) => {
      if (constraints.video) {
        videoCalls += 1;
        if (cameraError) throw cameraError;
        return fakeStreamFrom(cameraTrack);
      }
      return fakeStreamFrom(micTrack);
    }),
    get videoCalls() { return videoCalls; },
  };
}

function fakeDeps(overrides = {}) {
  const mediaDevices = overrides.mediaDevices ?? fakeMediaDevices();
  const composedVideo = fakeTrack('video');
  const mixedAudio = fakeTrack('audio');
  const compositor = {
    stream: fakeStreamFrom(composedVideo), start: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    removeCamera: vi.fn(), stop: vi.fn(() => composedVideo.stop()),
    effectiveSettings: () => ({ frameRate: 30 }),
  };
  const audioMixer = {
    tracks: [mixedAudio], setMicMuted: vi.fn(() => true), close: vi.fn(() => mixedAudio.stop()),
  };
  return {
    mediaDevices,
    MediaStreamCtor: class {
      constructor(tracks) { this.tracks = tracks; }
      getTracks() { return this.tracks; }
      getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
      getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
    },
    createVideoElement: () => ({ videoWidth: 1920, videoHeight: 1080, play: vi.fn(), srcObject: null }),
    createCanvas: () => ({ width: 0, height: 0 }),
    compositorFactory: vi.fn(() => compositor),
    audioMixerFactory: vi.fn(() => audioMixer),
    notify: vi.fn(),
    compositor,
    audioMixer,
    allTracks: [...mediaDevices.allTracks, composedVideo, mixedAudio],
    ...overrides,
  };
}
```

```js
it('camera-only never opens the display picker', async () => {
  const mediaDevices = fakeMediaDevices();
  const session = createMediaSession(fakeDeps({ mediaDevices }));
  const result = await session.prepare(normalizeRecordingOptions({ source: 'camera' }));
  expect(result.status).toBe('ready');
  expect(mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
  expect(mediaDevices.getUserMedia).toHaveBeenCalled();
});

it('combined mode keeps display pending for continue-without-camera', async () => {
  const mediaDevices = fakeMediaDevices({ cameraError: namedError('NotAllowedError') });
  const session = createMediaSession(fakeDeps({ mediaDevices }));
  const blocked = await session.prepare(normalizeRecordingOptions({
    source: 'screen', inputs: { mic: true, systemAudio: true, camera: true },
  }));
  expect(blocked.status).toBe('camera-decision');
  const resumed = await session.continueWithoutCamera();
  expect(resumed.status).toBe('ready');
  expect(mediaDevices.displayTrack.stop).not.toHaveBeenCalled();
});

it('cleanup stops every original and composed track exactly once', async () => {
  const deps = fakeDeps();
  const session = createMediaSession(deps);
  await session.prepare(normalizeRecordingOptions({
    source: 'screen', inputs: { mic: true, systemAudio: true, camera: true },
  }));
  await Promise.all([session.cleanup(), session.cleanup()]);
  for (const track of deps.allTracks) expect(track.stop).toHaveBeenCalledOnce();
  expect(deps.audioMixer.close).toHaveBeenCalledOnce();
  expect(deps.compositor.stop).toHaveBeenCalledOnce();
});
```

- [ ] **Step 3: Run both suites and verify they fail**

Run: `npm test --workspace=apps/extension -- audioMixer mediaSession`

Expected: FAIL because both modules do not exist.

- [ ] **Step 4: Implement the audio graph**

Create one `AudioContext` only when at least one audio track exists. Connect microphone through a `GainNode`, connect system audio directly, connect both only to `createMediaStreamDestination()`, and expose exactly the destination audio tracks. `setMicMuted(true)` sets mic gain to `0`; unmute sets it to `1`. `close()` disconnects nodes and closes the context exactly once.

- [ ] **Step 5: Implement media acquisition and source policy**

Use exact display preferences:

```js
const DISPLAY_SURFACE = { tab: 'browser', window: 'window', screen: 'monitor' };
const displayConstraints = {
  video: { cursor: options.cursor ? 'always' : 'never', displaySurface: DISPLAY_SURFACE[options.source] },
  audio: options.systemAudio,
  preferCurrentTab: options.source === 'tab',
  surfaceSwitching: 'include',
};
```

Chrome's picker remains authoritative. Acquire display first for display modes, then camera when requested, then microphone. Request camera-only video up to 1920×1080; request combined camera video no larger than the compositor's maximum rendered bubble. Translate media errors to the warning codes defined in Interfaces.

Build the final stream as follows:

- screen-only: display video plus mixer output.
- combined: compositor canvas video plus mixer output.
- camera-only: compositor canvas video plus mixer output.

Store every original stream in one `Set`. Register display `onended`, camera `onended`, and system-audio `onended` callbacks. Combined camera loss calls `compositor.removeCamera()` and emits `camera_lost`; camera-only loss emits `camera_only_lost` so Task 6 can stop and preserve the partial file. System-audio loss emits `system_audio_lost` while the mixer destination and remaining microphone/video tracks continue.

- [ ] **Step 6: Implement idempotent cleanup and lifecycle delegation**

`pause()` and `resume()` delegate to the compositor only when present. `setMicMuted()` delegates to the audio mixer and reports `false` when no mic track exists. `cleanup()` uses one cached promise, stops all originals and final tracks, clears video `srcObject`s, stops the compositor, closes the mixer, and clears held decision state.

- [ ] **Step 7: Run focused and extension regression tests**

Run: `npm test --workspace=apps/extension -- audioMixer mediaSession compositor recordingOptions`

Expected: PASS.

- [ ] **Step 8: Commit for task review**

Run: `git diff --check -- apps/extension/offscreen apps/extension/tests`

Expected: no whitespace errors. Confirm no captured audio node connects to `audioContext.destination`, then commit with `feat(extension): add camera media session` for task review.

---

### Task 6: Integrate the offscreen recording pipeline

**Files:**

- Modify: `apps/extension/offscreen/offscreen.html`
- Modify: `apps/extension/offscreen/offscreen.js`
- Create: `apps/extension/offscreen/recorder.js`
- Modify: `apps/extension/tests/mediaSession.test.js`
- Create: `apps/extension/tests/offscreenRecorder.test.js`

**Interfaces:**

- Consumes `createMediaSession()` from Task 5.
- Preserves existing blob actions: `offscreen_getRecordingBlob`, `offscreen_storeRecordingBlob`, `offscreen_getRecordingBlobAsArrayBuffer`, `offscreen_getBlobInfo`, and `offscreen_getBlobChunk`.
- Produces `offscreen_prepareRecording`, `offscreen_continueWithoutCamera`, `offscreen_startMediaRecorder`, `offscreen_stopRecording`, `offscreen_pauseRecording`, `offscreen_resumeRecording`, and `offscreen_setMicMuted` responses.

- [ ] **Step 1: Write failing offscreen protocol tests**

Test `createOffscreenRecorder(deps)` exported from `offscreen/recorder.js`:

```js
const cameraOnlyOptions = normalizeRecordingOptions({
  source: 'camera', inputs: { mic: true, systemAudio: false, camera: true },
});

const fakeStream = (...kinds) => {
  const tracks = kinds.map((kind) => ({ kind, stop: vi.fn() }));
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
  };
};

function fakePreparedSession({ onWarning } = {}) {
  const stream = fakeStream('video', 'audio');
  return {
    prepare: vi.fn(async () => ({ status: 'ready', stream, warnings: [], effectiveSettings: {} })),
    continueWithoutCamera: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    setMicMuted: vi.fn(), cleanup: vi.fn(), sourceFrame: vi.fn(), onWarning,
  };
}

function fakeMediaRecorder() {
  class FakeMediaRecorder {
    static instance;
    static isTypeSupported = vi.fn(() => true);
    constructor(stream, options) {
      this.stream = stream;
      this.mimeType = options.mimeType;
      this.state = 'inactive';
      FakeMediaRecorder.instance = this;
    }
    start() { this.state = 'recording'; }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop?.(); }
    emitData(blob) { this.ondataavailable?.({ data: blob }); }
  }
  return FakeMediaRecorder;
}
```

```js
it('prepares camera-only, records one stream, and preserves the blob contract', async () => {
  const session = fakePreparedSession();
  const MediaRecorderCtor = fakeMediaRecorder();
  const recorder = createOffscreenRecorder({ session, MediaRecorderCtor, now: () => 1234 });
  expect(await recorder.prepare(cameraOnlyOptions)).toMatchObject({ status: 'ready' });
  expect(await recorder.start()).toEqual({ startTime: 1234 });
  MediaRecorderCtor.instance.emitData(new Blob(['video']));
  await recorder.stop();
  expect(recorder.blobInfo()).toMatchObject({ size: 5 });
});

it('stops a camera-only recording when the camera track ends', async () => {
  const notify = vi.fn();
  const recorder = createOffscreenRecorder({
    session: fakePreparedSession({ onWarning: (warning) => notify(warning) }),
    MediaRecorderCtor: fakeMediaRecorder(), notify,
  });
  await recorder.prepare(cameraOnlyOptions);
  await recorder.start();
  recorder.handleSourceWarning('camera_only_lost');
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ action: 'recordingComplete' }));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test --workspace=apps/extension -- offscreenRecorder`

Expected: FAIL because `createOffscreenRecorder` is not exported and the new protocol is absent.

- [ ] **Step 3: Convert the offscreen entry point to a module**

Change `offscreen.html` to:

```html
<script type="module" src="offscreen.js"></script>
```

Import `createMediaSession`, `createOffscreenRecorder`, and `normalizeRecordingOptions` in `offscreen.js`. Keep `offscreen.js` as the thin Chrome message entry point. Put recorder state and blob methods in `recorder.js` so Vitest can import them without constructing a Chrome runtime.

- [ ] **Step 4: Route preparation through one media session**

`prepare(rawOptions)` normalizes once, calls `session.prepare()`, and stores only a ready final stream or a camera decision. Do not create `MediaRecorder` before the countdown. `continueWithoutCamera()` calls the held session decision and returns the same ready response shape.

Map session warnings to runtime messages:

```js
notify({ action: 'offscreen_captureWarning', warning });
```

For `camera_only_lost`, call the same stop/finalize path as Chrome's native Stop sharing action. For combined `camera_lost`, continue recording after notifying.

- [ ] **Step 5: Preserve MediaRecorder and blob behavior**

Create the recorder from the session's final stream with the existing VP9 → VP8 → WebM fallback. Keep one-second chunks. On stop, build `currentRecordingBlob`, notify `offscreen_recordingBlobReady`, then call `session.cleanup()`. Preserve every chunked blob retrieval response exactly so the web share page remains unchanged.

Pause/resume must call both `MediaRecorder.pause()`/`resume()` and `session.pause()`/`resume()`. Mic mute delegates to `session.setMicMuted()`.

- [ ] **Step 6: Remove superseded global track ownership**

Delete `originalDisplayStream`, `originalMicStream`, `recordingStream`, `pendingStream`, `pendingVideoTracks`, and their duplicate cleanup logic only after all retrieval/crop/source-frame functions use the session. `grabSourceFrame(maxWidth)` becomes `session.sourceFrame(maxWidth)` for display sessions and returns `null` for camera-only.

- [ ] **Step 7: Run protocol and regression suites**

Run: `npm test --workspace=apps/extension -- offscreenRecorder mediaSession audioMixer compositor`

Expected: PASS.

- [ ] **Step 8: Commit for task review**

Run: `git diff --check -- apps/extension/offscreen apps/extension/tests`

Expected: no whitespace errors. Confirm the old and new stream owners do not coexist, then commit with `feat(extension): integrate composed recording pipeline` for task review.

---

### Task 7: Background coordination, warnings, fallback, and countdown

**Files:**

- Modify: `apps/extension/background/background.js`
- Modify: `apps/extension/popup/state.js`
- Modify: `apps/extension/popup/popup.js`
- Modify: `apps/extension/popup/render.js`
- Create: `apps/extension/tests/recordingCoordinator.test.js`
- Modify: `apps/extension/tests/state.test.js`
- Modify: `apps/extension/tests/render.test.js`

**Interfaces:**

- Consumes the offscreen protocol from Task 6 and canonical options from Task 1.
- Produces popup messages `sourcePicked`, `captureWarning`, `cameraDecisionRequired`, `recordingStarted`, `startFailed`, and `recordingStopped`.
- Produces popup action `continueWithoutCamera` and forwards live mic state through `setMicMuted`.

- [ ] **Step 1: Write failing coordinator contract tests**

Use source-text contract tests, matching the repository's existing background/content testing style:

```js
const BACKGROUND = read('../background/background.js');

it('prepares camera-only without waiting for a display picker', () => {
  expect(BACKGROUND).toMatch(/options\.source === 'camera'/);
  expect(BACKGROUND).toMatch(/offscreen_prepareRecording/);
  expect(BACKGROUND).toMatch(/notifyPopup\(\{ action: 'sourcePicked'/);
});

it('uses the selected countdown instead of a hard-coded 3500ms', () => {
  expect(BACKGROUND).toMatch(/countdownMs\(options\.countdown\)/);
  expect(BACKGROUND).not.toMatch(/setTimeout\(resolve, 3500\)/);
});

it('holds the display stream while the user chooses continue without camera', () => {
  expect(BACKGROUND).toMatch(/cameraDecisionRequired/);
  expect(BACKGROUND).toMatch(/offscreen_continueWithoutCamera/);
});
```

- [ ] **Step 2: Run the coordinator suite and verify it fails**

Run: `npm test --workspace=apps/extension -- recordingCoordinator`

Expected: FAIL because the new protocol and dynamic countdown are absent.

- [ ] **Step 3: Refactor start into explicit preparation states**

In `startRecording(options)`:

1. Normalize/validate the request received from popup.
2. Permit `source === 'camera'` even when the active tab is restricted, because camera-only does not inject into or capture that page.
3. Create the offscreen document.
4. Send `offscreen_prepareRecording`.
5. On `ready`, notify `sourcePicked`, show countdown where injection is possible, wait `countdownMs(options.countdown)`, and start `MediaRecorder`.
6. On `camera-decision`, keep the offscreen document alive, persist pending options, and notify `cameraDecisionRequired`.
7. On fatal/cancelled preparation, close offscreen, clear state, and notify `startFailed`.

Implement exact countdown timing:

```js
const countdownMs = (seconds) => Math.max(0, Number(seconds) || 0) * 1000 + 500;
```

Send the actual countdown value to `showCountdown`; update `content.js` so zero skips the numbered overlay.

Persist a pending camera decision as `captureState: { view: 'permission', pendingPermission: 'camera', decisionRequired: true, warning }`. `getCaptureState` must return this state when the popup reopens; otherwise the toolbar popup closes during Chrome's picker and the user would have no route to Continue without camera.

- [ ] **Step 4: Implement continue-without-camera and warning routing**

Handle `{ action: 'continueWithoutCamera' }` asynchronously. Send `offscreen_continueWithoutCamera`, update pending options to `camera: false`, then run the same countdown/start helper without reopening the screen picker.

Map offscreen warnings:

- `mic_permission_denied` → popup warning and recording continues muted.
- `system_audio_unavailable` → popup warning and recording continues.
- `camera_lost` → popup warning and combined recording continues.
- `camera_only_lost` → ordinary recording completion after the partial blob finalizes.

Do not use a warning as an error state unless recording cannot continue.

- [ ] **Step 5: Restore complete live state when popup reopens**

Store `recordingOptions`, `micMuted`, `hasMicrophoneTrack`, and warnings with `isRecording`/`recordingStartTime`. `getCaptureState` returns them so the live view renders the microphone button accurately. Clicking `[data-live-mic]` dispatches `SET_MIC_MUTED`, updates popup state, and sends `{ action: 'setMicMuted', muted }`.

`CONTINUE_WITHOUT_CAMERA` sends `{ action: 'continueWithoutCamera' }`; it must not send a second `startRecording` request.

- [ ] **Step 6: Add state/render tests for fallback and live mute**

```js
it('continues a pending combined take without asking for a new source', () => {
  const required = transition(initialState(), {
    type: 'CAMERA_WARNING', warning: 'camera_permission_denied', decisionRequired: true,
  });
  const continued = transition(required, { type: 'CONTINUE_WITHOUT_CAMERA' });
  expect(continued.inputs.camera).toBe(false);
  expect(continued.view).toBe('arming');
});

it('shows live mic control only when the session owns a mic track', () => {
  const live = { ...recording(), hasMicrophoneTrack: true, micMuted: false };
  expect(mount(live).querySelector('[data-live-mic]').textContent).toContain('Mute microphone');
  expect(mount({ ...live, hasMicrophoneTrack: false }).querySelector('[data-live-mic]')).toBeNull();
});
```

- [ ] **Step 7: Run lifecycle-focused suites**

Run: `npm test --workspace=apps/extension -- recordingCoordinator state render offscreenRecorder`

Expected: PASS.

- [ ] **Step 8: Commit for task review**

Run: `git diff --check -- apps/extension/background apps/extension/popup apps/extension/content/content.js apps/extension/tests`

Expected: no whitespace errors. Confirm camera-only works on restricted active tabs, then commit with `feat(extension): coordinate camera recording lifecycle` for task review.

---

### Task 8: Retire the second in-page camera owner

**Files:**

- Modify: `apps/extension/content/content.js`
- Modify: `apps/extension/background/utils/contentScriptManager.js`
- Modify: `apps/extension/manifest.json`
- Replace contents: `apps/extension/tests/webcamOverlay.test.js`
- Delete: `apps/extension/content/webcam.js`
- Delete: `apps/extension/content/webcam.core.js`
- Delete: `apps/extension/tests/webcam.test.js`

**Interfaces:**

- Consumes live mic messages and recording state from Task 7.
- Produces an in-page recording bar that controls pause/resume/stop/mic only; it never calls `getUserMedia` for video.
- Leaves camera acquisition exclusively in popup preview (temporary) and offscreen media session (final).

- [ ] **Step 1: Replace legacy webcam assertions with no-second-stream tests**

```js
it('the content overlay never opens camera hardware', () => {
  expect(CONTENT).not.toMatch(/getUserMedia\(\{\s*video:/);
  expect(CONTENT).not.toMatch(/startWebcam\(/);
});

it('the recording bar still controls the offscreen microphone', () => {
  expect(CONTENT).toMatch(/action:\s*'setMicMuted'/);
  expect(CONTENT).toMatch(/micMutedChanged/);
});

it('the content script manager injects only the recording controls', () => {
  expect(INJECT).not.toMatch(/content\/webcam\.js/);
  expect(INJECT).toMatch(/content\/content\.js/);
});
```

- [ ] **Step 2: Run the legacy overlay suite and verify it fails**

Run: `npm test --workspace=apps/extension -- webcamOverlay`

Expected: FAIL because `content.js` still opens camera hardware and the manager still injects `webcam.js`.

- [ ] **Step 3: Remove camera ownership from content scripts**

Delete `webcamStream`, `webcamElement`, `webcamStarting`, `webcamWanted`, preview message cases, `startWebcam`, camera drag/shape controls, and `stopWebcam` from `content.js`. Keep the recording bar and timer. Add a real microphone button beside pause/stop; it sends `setMicMuted`, updates on `micMutedChanged`, and names Mute/Unmute in its accessible label.

`showRecordingOverlay` no longer accepts or acts on a webcam flag. `hideRecordingOverlay` removes UI state but does not own hardware cleanup; Task 6's media session is the hardware owner.

- [ ] **Step 4: Remove obsolete injection and accessible resources**

Change `ContentScriptManager.inject` to load `content/content.js` without `content/webcam.js`. Remove `content/webcam.js` from `manifest.json` web-accessible resources. Delete `webcam.js`, `webcam.core.js`, and their pure-module drift test only after the new no-second-stream suite passes.

- [ ] **Step 5: Run content, manifest, and full extension tests**

Run: `npm test --workspace=apps/extension -- webcamOverlay`

Expected: PASS.

Run: `npm test --workspace=apps/extension`

Expected: all extension tests PASS, including screenshots, popup, tokens, region selection, queue, and recording controls.

- [ ] **Step 6: Commit for task review**

Run: `git diff --check -- apps/extension/content apps/extension/background/utils/contentScriptManager.js apps/extension/manifest.json apps/extension/tests`

Expected: no whitespace errors. Search with `rg -n "startWebcam|getWebcamPreview|setWebcamPreview|content/webcam" apps/extension` and confirm no live runtime reference remains, then commit with `refactor(extension): centralize camera ownership` for task review.

---

### Task 9: End-to-end regression and manual Chrome verification

**Files:**

- Modify only files identified by failures in Tasks 1–8; do not add new product scope.

**Interfaces:**

- Verifies the complete contracts from Tasks 1–8.
- Produces no new runtime API.

- [ ] **Step 1: Run the complete automated extension suite**

Run: `npm test --workspace=apps/extension`

Expected: all tests PASS with no unhandled promise rejection, leaked timer, or jsdom media error.

- [ ] **Step 2: Inspect the final manifest and package inputs**

Run: `node -e "const m=require('./apps/extension/manifest.json'); console.log(m.manifest_version, m.version, m.web_accessible_resources.flatMap(x=>x.resources).filter(x=>x.includes('webcam')))"`

Expected: manifest version `3`, the intended package version, and `[]` for obsolete webcam runtime resources.

- [ ] **Step 3: Load the extension unpacked and verify the base matrix**

In Chrome, load `apps/extension` unpacked. For each row, record at least five seconds, stop, and play the resulting local file:

| Source | Camera | Mic | System audio | Expected |
|---|---:|---:|---:|---|
| This tab | Off | On | On | Existing screen-only behavior; voice and tab audio present |
| Window | Off | Off | On where supported | Existing window capture; no mic |
| Screen | Off | On | Off | Existing display capture; mic present |
| This tab | On | On | On | One camera bubble, voice and tab audio |
| Window | On | On | On where supported | One camera bubble; available audio sources present |
| Screen | On | Off | Off | One silent camera bubble over display |
| Camera only | Required | On | Hidden | Full-frame 16:9 camera with voice |
| Camera only | Required | Off | Hidden | Full-frame silent camera |

- [ ] **Step 4: Verify placement, shape, quality, and mirroring**

For combined mode, test circle and rounded shapes at minimum, default, and maximum sizes in multiple corners. Confirm the output placement matches the normalized popup preview, stays inside the frame, and remains fixed during recording. Confirm the popup preview is mirrored and a piece of readable text in camera view is not mirrored in the saved file.

Record 720p/24, 1080p/30, and 1440p/60 where the device supports them. Inspect track settings/logs and ensure SnapRec does not label an effective rate or camera resolution higher than the captured source provides.

- [ ] **Step 5: Verify failures and cleanup**

Exercise these exact cases:

- Deny camera in camera-only: no countdown, Retry guidance, no live camera light after dismissal.
- Deny camera in combined: Continue without camera uses the already selected display without a second picker.
- Deny microphone: recording continues muted.
- Omit Share audio: recording continues with the system-audio warning.
- Disconnect camera during combined: bubble disappears and screen continues.
- Disconnect camera during camera-only: partial recording finalizes and plays.
- Cancel picker and cancel countdown: no output and no live hardware.
- Stop from popup, page bar, and Chrome sharing indicator: one completion, all hardware indicators off.
- Pause/resume: output timeline excludes the pause and camera position remains stable.

- [ ] **Step 6: Verify downstream and UI regressions**

For one camera-only and one combined file, verify Download, open in editor, upload, and generated share link. Confirm no separate camera file is created. Exercise visible-area, region, and full-page screenshots. At 100% and 125% browser zoom, check the ready, camera-only, combined, permission, warning, recording, paused, and completion popup views for clipping, correct tab order, readable status words, and token-consistent styling.

- [ ] **Step 7: Run final automated verification after manual fixes**

Run: `npm test --workspace=apps/extension`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 8: Commit verification fixes for task review**

Run: `git status --short`

Expected: only intentional verification fixes are present. Commit them with `test(extension): verify camera recording flows` for task review. Report the automated commands, manual Chrome matrix results, known operating-system system-audio limitations, and any unverified hardware combinations. Do not push.
