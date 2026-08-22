# Camera Recording Design

**Status:** Approved in conversation and as a written specification on 2026-08-11.

## Goal

Add camera-only and screen-plus-camera recording to SnapRec while preserving the existing screen-only, completion, editing, download, upload, and sharing workflows.

## Context

SnapRec currently exposes a camera toggle and injects a webcam preview into the active webpage. The recording pipeline itself only owns the display and audio streams. It does not composite a camera stream into the recorded video, and it has no camera-only source. The injected overlay is therefore not a reliable foundation for camera recording across tab, window, and full-screen capture.

The new implementation will compose video locally in the extension. It will produce one ordinary recording file, so the server, viewer, editor, upload, and sharing contracts do not need a new media format.

## User-visible scope

The Record view supports four sources:

- This tab
- Window
- Screen
- Camera only

For tab, window, and screen sources, the user can enable or disable:

- Microphone
- System audio
- Camera overlay

For camera-only recording:

- Camera is required and cannot be disabled.
- Microphone is enabled by default and can be muted.
- System audio is hidden because no display is being shared.
- The preview and output use a 16:9 frame.
- The preview is mirrored for natural framing; the saved recording is not mirrored.

For screen-plus-camera recording:

- The camera appears as a picture-in-picture bubble over the display preview.
- The default placement is the bottom-right corner.
- Before recording, the user can drag the bubble, resize it, and choose a circle or rounded rectangle.
- Position and size are stored as normalized values and are independent of output resolution.
- Placement remains fixed during the active recording in V1.
- The saved video permanently includes the camera bubble.

## Interface design

The feature extends the current popup rather than introducing a separate visual system. New controls and states must reuse existing SnapRec components, typography, spacing, corner treatments, and `--sr-*` design tokens. Design-system components must not add hard-coded hex colors or `dark:` utilities.

The existing source radio group gains a Camera option. Selecting Camera changes the preview to the full camera frame and hides the system-audio and camera-toggle rows. Selecting a display source keeps the current source preview and exposes the camera toggle.

When the camera toggle is on for a display source, the popup preview renders the camera bubble above the source thumbnail. Before Chrome's picker has run, This tab uses its live thumbnail while Window and Screen use the current-tab thumbnail as a layout surface; the UI must not imply that this is the eventual shared source. The normalized placement applies to whichever source the user subsequently chooses in Chrome's picker. Dragging changes the bubble's center position; a visible corner handle changes its size. The same interactions must be available by keyboard. Arrow keys move the selected bubble, and Shift+Arrow changes its size.

The live Recording and Paused views gain a microphone control whenever the session has a microphone track. It uses the existing input-row and status-word treatments, updates the offscreen microphone track through the background coordinator, and remains available when the popup is reopened. This is the reliable mute route for camera-only recordings and for pages where an injected recording bar cannot be shown.

Camera layout uses this contract:

```js
{
  shape: 'circle' | 'rounded',
  centerX: 0.88,
  centerY: 0.82,
  width: 0.18,
}
```

`centerX` is a fraction of output width, `centerY` is a fraction of output height, and `width` is a fraction of output width. Width is clamped to `0.12` through `0.32`. Position is clamped after accounting for the rendered bubble dimensions, so the camera cannot be placed outside the final frame. A circle uses equal pixel width and height. A rounded rectangle uses the camera's 16:9 crop.

The camera layout is stored in `chrome.storage.local` and reused for later recordings. Camera-only framing does not overwrite the picture-in-picture layout.

## Architecture

### Popup state and preview

The popup state gains:

```js
source: 'tab' | 'window' | 'screen' | 'camera'
inputs: {
  mic: boolean,
  systemAudio: boolean,
  camera: boolean,
}
cameraLayout: {
  shape: 'circle' | 'rounded',
  centerX: number,
  centerY: number,
  width: number,
}
options: {
  resolution: '720p' | '1080p' | '1440p',
  fps: 24 | 30 | 60,
  countdown: 0 | 3 | 5,
  autoZoom: boolean,
  cursor: boolean,
}
```

The existing internal `tabAudio` name becomes `systemAudio` because the input also applies to window and screen capture. Stored legacy state, if any, is read with `tabAudio` as a fallback and rewritten using `systemAudio`.

A focused camera-preview controller owns the temporary popup `getUserMedia()` stream. It starts only in response to a user camera selection, stops when the camera is deselected or the popup closes, and is always released before the final recording stream is acquired. Preview failure is translated into popup state rather than handled inside the renderer.

### Recording coordinator

The background service worker remains the capture lifecycle coordinator. It receives a complete recording request, creates the offscreen document, waits for required sources, begins the countdown only after the sources are ready, starts `MediaRecorder`, broadcasts state, and owns cancellation and cleanup requests.

Camera-only recording skips Chrome's display-sharing picker. The coordinator treats successful camera acquisition as the source-picked event and then runs the configured countdown.

Display modes continue to use Chrome's standard picker. The selected popup source is passed as a picker preference (`browser`, `window`, or `monitor`), but Chrome's picker remains authoritative and the extension must accept the source the user actually chooses. A cancelled picker returns the popup to Ready and releases any final camera or microphone stream already acquired.

### Media sources

A media-source controller in the offscreen document owns all final capture streams:

- `getDisplayMedia()` supplies display video and optional system audio for tab, window, and screen modes.
- `getUserMedia()` supplies camera video for camera-only and combined modes.
- A separate `getUserMedia()` request supplies microphone audio when enabled, allowing microphone mute state to be controlled independently of camera video.

The final camera constraints should request only what the output requires. A picture-in-picture camera does not request a higher resolution than its maximum rendered dimensions. Camera-only capture targets up to 1920×1080 unless the selected device supplies a lower resolution. The selected output can still be 1440p, but the implementation must not claim that an upscaled camera is native 1440p.

### Video compositor

Screen-only recording preserves the current direct display-video path. It does not pass through a canvas.

Camera-only and screen-plus-camera recordings use a dedicated compositor:

1. Hidden video elements receive the display and camera streams.
2. A canvas is sized to the selected output resolution: 1280×720, 1920×1080, or 2560×1440.
3. The display frame is drawn to preserve its aspect ratio. Any letterbox area is opaque black.
4. For combined recording, the compositor crops the camera with `cover` semantics, clips it to the selected shape, and draws it at the normalized layout coordinates.
5. For camera-only recording, the camera is center-cropped with `cover` semantics to the full 16:9 canvas.
6. Preview mirroring is not applied to the output canvas.
7. `canvas.captureStream(selectedFps)` supplies the final video track.

The compositor requests 24, 30, or 60 FPS according to the setting. The browser or source may deliver fewer unique frames than requested; the recorder must read and retain the effective track settings for diagnostics without claiming an unsupported rate. Existing frame-rate UI must be backed by real popup state rather than a fixed value.

### Audio mixer

An audio mixer owns the final audio track:

- Microphone plus system audio: connect both to one `MediaStreamAudioDestinationNode`.
- Microphone only: use the microphone track directly or through the same destination.
- System audio only: use the display audio track directly or through the same destination.
- Neither: produce a video-only stream.

The mixer never connects captured audio to the user's speakers. Microphone mute toggles the microphone track or its gain without stopping the video recording. Ending one audio source does not end the remaining sources.

### Recorder and downstream flow

The existing `MediaRecorder` receives one composed video track and zero or one final audio track. Its blob, IndexedDB storage, completion state, download, editor, upload, and share-link paths remain unchanged.

Recording options and camera layout are stored with the active recording state for recovery and diagnostic logs. No raw camera frames, preview images, or additional media files are persisted.

## Lifecycle and cleanup

Every acquired stream is registered with a single session-scoped cleanup owner. Cleanup is idempotent and runs on:

- Normal stop
- Display sharing ended from Chrome's indicator
- Camera-only camera disconnection
- Picker cancellation
- Countdown cancellation
- Permission failure
- Recorder failure
- Offscreen document shutdown

Cleanup stops display, camera, and microphone tracks; cancels the compositor loop; clears video element sources; closes the audio context; clears pending streams; and removes active recording state. Camera and microphone hardware indicators must turn off immediately after cleanup.

## Permissions and recovery

- Camera denied in camera-only mode: do not start; show Retry and browser-settings guidance.
- Camera denied in combined mode: offer Continue without camera and retain the selected display source.
- Microphone denied: continue muted and show a non-blocking warning.
- Display picker cancelled: return to Ready without countdown or recorded bytes.
- System audio requested but unavailable: continue with display and microphone, and identify that system audio was omitted.
- Camera lost during combined recording: remove the camera bubble and continue screen recording.
- Camera lost during camera-only recording: stop safely and preserve the partial recording.
- System audio lost during recording: continue with microphone or video only.
- Display track ended: finalize through the ordinary completion flow.

Permission, warning, and recovery screens reuse the existing popup states and components. A permission failure must not leave a camera preview stream running.

## Performance constraints

- Screen-only capture does not pay the canvas-composition cost.
- Composition occurs entirely in the offscreen document.
- The temporary popup preview is released before final acquisition, preventing two concurrent camera streams.
- Camera constraints are based on rendered need rather than the maximum device capability.
- Canvas rendering stops while the recorder is paused and resumes without changing the output timeline contract.
- Processing remains local until the user explicitly requests upload or sharing.

## Testing strategy

Automated extension tests cover:

- State transitions for display, combined, and camera-only recording
- Conditional rendering of microphone, system-audio, and camera controls
- Migration from `tabAudio` to `systemAudio`
- Camera layout defaults, clamping, dragging, keyboard movement, and resizing
- Circle and rounded-rectangle compositor geometry
- Camera-only 16:9 cropping and unmirrored output
- Audio combinations: microphone only, system audio only, mixed, and silent
- Camera, microphone, and display permission outcomes
- Continue-without-camera behavior
- Camera and system-audio disconnection behavior
- Pause, resume, stop, cancellation, and partial recording preservation
- Idempotent cleanup of every acquired track and audio context
- Regression coverage for screen-only recording and all screenshot modes

Manual Chrome verification covers:

- This tab, window, screen, camera-only, and screen-plus-camera recording
- Microphone enabled and muted
- System audio available and unavailable on supported operating systems
- Camera granted, denied, disconnected, and already in use
- All supported bubble positions, sizes, and shapes
- 720p, 1080p, and 1440p output
- 24, 30, and 60 FPS where supported
- Download, editor, upload, and share-link workflows
- Camera and microphone indicators after every stop and failure path
- Visual consistency with the existing SnapRec popup and design system

## Acceptance criteria

- A user can record themselves full-frame with the microphone enabled by default.
- A user can mute the microphone before or during camera-only recording.
- A user can record a tab, window, or screen with optional microphone and system audio.
- A user can include a pre-positioned and resized camera bubble in a display recording.
- The saved camera placement and shape match the preview.
- Camera-only and combined recordings produce one file accepted by existing downstream flows.
- Permission failures offer a clear recovery or fallback path.
- Every stop and failure path releases all media hardware.
- Existing screen-only recording and screenshot behavior remains unchanged.

## Out of scope for V1

- Moving or resizing the camera during an active recording
- Virtual backgrounds or background blur
- Multiple simultaneous cameras
- Separate editable screen and camera tracks
- Server-side media composition
- New server, viewer, or editor media formats
- A new standalone marketing or recording web page
