import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(resolve(__dirname, p), 'utf8');
const CSS = read('../content/content.css');
const CONTENT = read('../content/content.js');
const BACKGROUND = read('../background/background.js');
const POPUP = read('../popup/popup.js');
const FAB = read('../content/fab.js');
const FAB_CSS = read('../content/fab.css');
const OFFSCREEN = read('../offscreen/offscreen.js');
const INJECT = read('../background/utils/contentScriptManager.js');
const WEBCAM = read('../content/webcam.js');

/** The camera toggle used to flip its own switch and nothing else — the
 * overlay only ever appeared once a recording had started, so there was no
 * way to check framing or that the camera worked at all beforehand.
 *
 * Verified in Chrome with a fake camera device: toggling on puts a playing
 * 640x480 overlay on the page with one live track and a cyan ring; toggling
 * twice leaves one <video>, not two; starting a take promotes the same
 * element to coral without reopening the camera; and a take with the camera
 * off tears the preview down. These cases hold the wiring that makes that
 * possible, since none of it can run in jsdom. */
describe('the camera toggle shows a live overlay', () => {
  it('makes the popup toggle say so, rather than only recording it', () => {
    expect(POPUP).toMatch(/case 'TOGGLE_INPUT'/);
    expect(POPUP).toMatch(/setWebcamPreview/);
  });

  it('routes it through the background, which owns tabs and injection', () => {
    expect(BACKGROUND).toMatch(/case 'setWebcamPreview'/);
    expect(BACKGROUND).toMatch(/showWebcamPreview.*:.*hideWebcamPreview/s);
  });

  it('handles both messages in the page', () => {
    expect(CONTENT).toMatch(/case 'showWebcamPreview'/);
    expect(CONTENT).toMatch(/case 'hideWebcamPreview'/);
  });

  it('reuses the open camera instead of opening a second one', () => {
    // Two getUserMedia calls means two camera handles and two overlays.
    expect(CONTENT).toMatch(/if \(webcamElement\) \{[^}]*dataset\.preview[^}]*return;/s);
    expect(CONTENT.match(/mediaDevices\.getUserMedia/g)).toHaveLength(1);
  });

  it('guards the await, so a toggle-off mid-prompt does not leave it on', () => {
    expect(CONTENT).toMatch(/webcamWanted/);
    expect(CONTENT).toMatch(/if \(!webcamWanted\)/);
  });

  it('tears the preview down for a take that excludes the camera', () => {
    expect(CONTENT).toMatch(/startWebcam\(\{ preview: false \}\);\s*\} else \{[^}]*stopWebcam\(\)/s);
  });
});

describe('the ring says whether you are live', () => {
  it('is cyan while framing — focus, not capture', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*border:\s*3px solid #06A6C0/s);
  });

  it('is coral once recording, the one thing coral is reserved for', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\[data-preview="false"\]\s*\{\s*border-color:\s*#FF3B2E/s);
  });

  it('mirrors the picture, and only the picture', () => {
    // The mirror moved onto the inner video when the overlay gained controls:
    // mirroring the container would put the mic button where the eye says the
    // close button is.
    expect(CSS).toMatch(/\.snaprec-webcam-video\s*\{[^}]*transform:\s*scaleX\(-1\)/s);
    expect(CSS).not.toMatch(/\.snaprec-webcam\s*\{[^}]*transform:\s*scaleX\(-1\)/s);
  });

  it('keeps the pre-plate palette out of every in-page overlay', () => {
    // Not just the webcam: content.css was the last surface still carrying
    // the old violet, plus a generic red and slate greys from before the
    // plate. The whole file is in scope so it cannot drift back one rule at
    // a time.
    expect(CSS).not.toMatch(/123,\s*37,\s*244|7b25f4|8B5CF6|6366f1/i);
    expect(CSS).not.toMatch(/#(ef4444|dc2626)\b/i);
    expect(CSS).not.toMatch(/#(475569|64748b|130d1c|ece7f4)\b/i);
  });
});


/** Reported from the field: the overlay came up but the switch still read
 * "off". The popup is rebuilt from initialState() every time it opens, and
 * the overlay outlives it, so the two drifted apart the moment the popup
 * closed — leaving a switch that needed two clicks to turn off a camera that
 * was already running.
 *
 * Verified in Chrome with a fake camera: with the overlay up and the page
 * frontmost, re-booting the popup reads the toggle as on, and a single click
 * then takes it to off with zero overlays left. A tab that never had an
 * overlay reads off. */
describe('the toggle matches the tab in front of you', () => {
  it('asks on open instead of assuming the default', () => {
    expect(POPUP).toMatch(/getWebcamPreview/);
    expect(POPUP).toMatch(/inputs:\s*\{\s*\.\.\.state\.inputs,\s*camera:\s*cam\.on\s*\}/);
  });

  it('answers from the page, which is where the overlay actually lives', () => {
    expect(BACKGROUND).toMatch(/message\.action === 'getWebcamPreview'/);
    expect(BACKGROUND).toMatch(/isWebcamPreviewOn/);
    expect(CONTENT).toMatch(/case 'isWebcamPreviewOn'/);
    expect(CONTENT).toMatch(/sendResponse\(\{ on: !!webcamElement \}\)/);
  });

  it('never answers from a stored preference', () => {
    // A stored flag lit the toggle on tabs showing no camera, so the first
    // click read as turning something off. Silence means no content script,
    // which means no overlay — so silence is false.
    expect(BACKGROUND).not.toMatch(/storage\.local\.(get|set)\(.*webcamPreview/);
    expect(BACKGROUND).toMatch(/sendResponse\(\{ on: reply\?\.on === true \}\)/);
    expect(BACKGROUND).toMatch(/catch \{\s*sendResponse\(\{ on: false \}\);/);
  });
});


/** Reported from the field: stopping a recording — by the in-page stop button
 * or by Chrome's own "Stop sharing" — left the camera running with its
 * overlay still on the page.
 *
 * Every stop path already called stopWebcam. The leak was upstream:
 * startWebcam guarded on webcamElement, which stays null for as long as
 * getUserMedia takes, so two calls inside that window each opened a camera
 * and the second overwrote the first's references. The orphan was live and
 * unreachable. The background makes this ordinary rather than exotic —
 * tabs.onActivated and tabs.onUpdated both inject the recording overlay for
 * the same tab.
 *
 * Reproduced in Chrome with a fake camera: two concurrent showRecordingOverlay
 * messages produced 2 <video> elements and 2 live streams, and hiding the
 * overlay left 1 of each behind. After the fix the same sequence gives 1 then
 * 0, and the full lifecycle — preview, record, in-page stop, record again,
 * Stop sharing — ends at zero cameras every time. */
describe('stopping a recording releases the camera', () => {
  it('serialises concurrent starts onto one camera', () => {
    expect(CONTENT).toMatch(/let webcamStarting = null;/);
    expect(CONTENT).toMatch(/if \(webcamStarting\) \{\s*await webcamStarting;/);
    expect(CONTENT).toMatch(/webcamStarting = \(async \(\) => \{/);
    // Cleared however the start ends, or every later start would wait on a
    // settled promise and never open the camera again.
    expect(CONTENT).toMatch(/finally \{\s*webcamStarting = null;\s*\}/);
  });

  it('records the intent before anything can clear it', () => {
    // showRecordingOverlay tears down the previous bar via
    // hideRecordingOverlay — which clears the flag — and then asks for the
    // camera again on the next line. Setting it after that check cancelled
    // the in-flight start and left no camera at all.
    expect(CONTENT).toMatch(
      /async function startWebcam\(\{ preview = false \} = \{\} \) *\{|async function startWebcam\(\{ preview = false \} = \{\}\) \{/);
    const body = CONTENT.slice(CONTENT.indexOf('async function startWebcam'));
    expect(body.indexOf('webcamWanted = true;')).toBeLessThan(body.indexOf('if (webcamElement)'));
  });

  it('sweeps every overlay in the page, not just the tracked one', () => {
    // A camera the page can still see is a camera that is still on, whoever
    // opened it. Stopping the tracks is what turns the light off; removing
    // the node only hides it.
    expect(CONTENT).toMatch(/querySelectorAll\('\.snaprec-webcam'\)\.forEach/);
    const sweep = CONTENT.slice(CONTENT.indexOf("querySelectorAll('.snaprec-webcam')"));
    expect(sweep).toMatch(/getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/);
    expect(sweep).toMatch(/overlay\.remove\(\)/);
  });

  it('still releases it on every stop path', () => {
    // The in-page stop button and the broadcast both land here.
    expect(CONTENT).toMatch(/function hideRecordingOverlay\(\)[\s\S]*?stopWebcam\(\);/);
    expect(CONTENT).toMatch(/function stopRecording\(\)[\s\S]*?hideRecordingOverlay\(\);/);
  });
});


/** Verified in Chrome with a fake camera at a 1200x800 viewport: the overlay
 * starts bottom-right, drags to where the pointer puts it, stores its place
 * as viewport percentages, comes back there after being toggled off and on,
 * keeps 48px on screen when dragged past the edge, and lets no click through
 * to the page while being moved. */
describe('the camera overlay can be moved', () => {
  it('drags with pointer events, so trackpad, pen and touch all work', () => {
    expect(CONTENT).toMatch(/addEventListener\('pointerdown'/);
    expect(CONTENT).toMatch(/addEventListener\('pointermove'/);
    expect(CONTENT).toMatch(/addEventListener\('pointerup', end\)/);
    // Without capture, moving faster than the render loop drops the overlay
    // as soon as the pointer leaves it.
    expect(CONTENT).toMatch(/setPointerCapture\(e\.pointerId\)/);
    // pointercancel is not optional: a system gesture takes the pointer away
    // without ever sending pointerup, and the overlay would stay stuck.
    expect(CONTENT).toMatch(/addEventListener\('pointercancel', end\)/);
  });

  it('lets no click reach the page after a drag', () => {
    // Dragging across a link or a canvas otherwise activated what was under
    // it, because a drag still ends in a click that bubbles into the page.
    expect(CONTENT).toMatch(/addEventListener\('click', \(e\) => \{\s*if \(!moved\) return;[\s\S]*?stopPropagation\(\);\s*\}, true\)/);
  });

  it('remembers where it was put, in viewport percentages', () => {
    // Percentages, because a stored 1400px left edge is off-screen in a
    // narrower window; a corner should stay a corner.
    expect(CONTENT).toMatch(/xPct: \(rect\.left \/ window\.innerWidth\) \* 100/);
    expect(CONTENT).toMatch(/yPct: \(rect\.top \/ window\.innerHeight\) \* 100/);
    expect(CONTENT).toMatch(/loadWebcamPosition/);
  });

  it('keeps a grabbable margin on screen', () => {
    // Fully clamping would forbid parking it half off the edge; clamping not
    // at all would strand it where it cannot be dragged back.
    expect(CONTENT).toMatch(/function clampWebcam\(value, size, limit\)/);
    expect(CONTENT).toMatch(/const visible = Math\.min\(size, 48\);/);
    // A window that shrinks past the overlay must not strand it either.
    expect(CONTENT).toMatch(/addEventListener\('resize'/);
  });

  it('says it is movable, and says when it is being moved', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*cursor:\s*grab/s);
    expect(CSS).toMatch(/\.snaprec-webcam\[data-dragging\]\s*\{[^}]*cursor:\s*grabbing/s);
    // The native drag image and text selection otherwise fight the handlers.
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*touch-action:\s*none/s);
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*user-select:\s*none/s);
  });
});


/** Found by running the extension rather than reading it: during a recording
 * the floating button still said "Start Recording", and its data-action was
 * still startRecording, so pressing it fired a second startRecording instead
 * of stopping the first.
 *
 * fab.js had always listened for recordingStarted/recordingStopped. Nothing
 * in the background had ever sent them, so the listener was dead and the
 * button's isRecording flag never left false.
 *
 * Verified in Chrome: before a recording the button reads startRecording /
 * "Start Recording", during one it reads stopRecording / "Stop Recording",
 * and it returns afterwards. */
describe('the floating button knows a recording is running', () => {
  it('is told when one starts and stops', () => {
    expect(BACKGROUND).toMatch(/async function broadcastRecordingState\(action\)/);
    expect(BACKGROUND).toMatch(/broadcastRecordingState\('recordingStarted'\)/);
    expect(BACKGROUND).toMatch(/broadcastRecordingState\('recordingStopped'\)/);
  });

  it('reaches every tab, since the button is on all of them', () => {
    const fn = BACKGROUND.slice(BACKGROUND.indexOf('async function broadcastRecordingState'));
    expect(fn).toMatch(/chrome\.tabs\.query\(\{\}\)/);
    // A restricted page has no content script, and messaging it only logs.
    expect(fn).toMatch(/isRestrictedUrl/);
  });

  it('still listens for both', () => {
    expect(FAB).toMatch(/message\.action === 'recordingStarted'/);
    expect(FAB).toMatch(/message\.action === 'recordingStopped'/);
    // The guard that made the dead state a real bug rather than a cosmetic one.
    expect(FAB).toMatch(/case 'startRecording':\s*if \(!isRecording\)/);
  });

  it('keeps its marks on the plate', () => {
    // The inline SVG fills were still the pre-plate red; content.css and
    // fab.css had been migrated but markup inside fab.js had not.
    expect(FAB).not.toMatch(/#EF4444/i);
    expect(FAB).toMatch(/#FF3B2E/);
    expect(FAB_CSS).not.toMatch(/123,\s*37,\s*244|7b25f4|8B5CF6/i);
  });
});


/** Controls on the overlay itself: mute, shape, and turn the camera off.
 *
 * Verified in Chrome with a fake camera and a real recording: the controls
 * are hidden until hover, muting flips the offscreen mic track to
 * enabled=false while leaving it live, the popup's switch agrees after a
 * re-boot, unmuting from the popup updates the overlay, and no script errors
 * are raised on the page. */
describe('the camera overlay carries its own controls', () => {
  it('is a container, because a <video> cannot hold children', () => {
    expect(CONTENT).toMatch(/webcamElement = document\.createElement\('div'\)/);
    expect(CONTENT).toMatch(/video\.className = 'snaprec-webcam-video'/);
    // Mirroring the container would put the mic button where the eye says
    // close is, so only the picture is flipped.
    expect(CSS).toMatch(/\.snaprec-webcam-video\s*\{[^}]*transform:\s*scaleX\(-1\)/s);
  });

  it('offers mute, shape and off — and nothing else', () => {
    // Bounded to the function: the file has classList.add calls further down.
    const from = CONTENT.indexOf('function buildWebcamControls');
    const bar = CONTENT.slice(from, CONTENT.indexOf('return bar;', from));
    expect(bar.match(/\badd\('(\w+)'/g)).toEqual(["add('mic'", "add('shape'", "add('close'"]);
    // Real buttons, so they are reachable by keyboard; a hover-only
    // affordance never is.
    expect(bar).toMatch(/createElement\('button'\)/);
    expect(bar).toMatch(/setAttribute\('aria-label'/);
  });

  it('hides them until they are wanted', () => {
    // Always-visible chrome would sit in every recording.
    expect(CSS).toMatch(/\.snaprec-webcam-controls\s*\{[^}]*opacity:\s*0/s);
    expect(CSS).toMatch(/\.snaprec-webcam:hover \.snaprec-webcam-controls[\s\S]*?opacity:\s*1/);
    expect(CSS).toMatch(/:focus-within \.snaprec-webcam-controls/);
  });

  it('does not let a control press drag the overlay', () => {
    // The drag handler is on the container, and would otherwise swallow the
    // gesture and move the overlay instead of pressing the button.
    expect(CONTENT).toMatch(/bar\.addEventListener\('pointerdown', \(e\) => e\.stopPropagation\(\)\)/);
  });

  it('still works after the overlay has been dragged', () => {
    // Found in the browser: the drag's click-swallower runs in the capture
    // phase on the container, so it ate the first click on a control after
    // any drag — and because the bar stops pointerdown, `moved` never reset,
    // so it ate every one after that. Drag the overlay, press mute, nothing
    // happened.
    const guard = CONTENT.slice(CONTENT.indexOf("el.addEventListener('click'"));
    expect(guard).toMatch(/moved = false;/);
    expect(guard).toMatch(/closest\?\.\('\.snaprec-webcam-controls'\)\) return;/);
  });

  it('mutes for real, in the one place that holds the microphone', () => {
    expect(CONTENT).toMatch(/action: 'setMicMuted'/);
    expect(BACKGROUND).toMatch(/case 'setMicMuted'/);
    expect(BACKGROUND).toMatch(/offscreen_setMicMuted/);
    expect(OFFSCREEN).toMatch(/case 'offscreen_setMicMuted'/);
    // enabled=false, never stop(): stopping ends the track for good, and
    // unmuting could not bring it back without prompting again.
    expect(OFFSCREEN).toMatch(/getAudioTracks\(\)\.forEach\(\(track\) => \{ track\.enabled = !muted; \}\)/);
  });

  it('keeps the popup switch and the overlay button on one setting', () => {
    expect(BACKGROUND).toMatch(/storage\.local\.set\(\{ micMuted/);
    expect(BACKGROUND).toMatch(/message\.action === 'getMicMuted'/);
    expect(POPUP).toMatch(/getMicMuted/);
    expect(POPUP).toMatch(/event\.input === 'mic'/);
    // And whichever moved, the other is told.
    expect(BACKGROUND).toMatch(/action: 'micMutedChanged'/);
    expect(CONTENT).toMatch(/case 'micMutedChanged'/);
  });

  it('says muted in words, on a chip that survives the camera image', () => {
    expect(CONTENT).toMatch(/statusLabel\(state\)/);
    // A text-shadow alone vanishes against a bright or busy frame, and this
    // has to stay readable when the recording is watched back.
    expect(CSS).toMatch(/\.snaprec-webcam-status\s*\{[^}]*background:\s*rgba\(4, 7, 8, \.82\)/s);
  });

  it('takes its shape rules from the tested module rather than repeating them', () => {
    // webcam.js had no consumer at all until now — nothing injected it.
    expect(INJECT).toMatch(/'content\/webcam\.js', 'content\/content\.js'/);
    expect(CONTENT).toMatch(/globalThis\.SnapRecWebcam/);
    expect(CONTENT).toMatch(/rules\.shapeFor\(webcamShape\)/);
  });

  it('survives being injected twice', () => {
    // A classic script re-running threw "Identifier 'SHAPES' has already been
    // declared", which killed the content script for that tab.
    expect(WEBCAM).toMatch(/var SHAPES = \{/);
    expect(WEBCAM).not.toMatch(/const SHAPES = \{/);
  });
});


/** The popup's preview showed whichever tab happened to be in front, because
 * captureVisibleTab is all it could reach. That is the recorded source only
 * when recording the current tab; pick a window, another tab or a screen and
 * the popup showed something else entirely.
 *
 * Verified in Chrome: with the active tab painted solid pink and a recording
 * running, the popup's frame contains no pink at all — it cannot have come
 * from captureVisibleTab — is scaled to 320px, and changes between grabs. */
describe('the popup previews what is actually being recorded', () => {
  it('reads frames from the stream, which only the offscreen document holds', () => {
    // A MediaStream does not cross contexts, so frames it is.
    expect(OFFSCREEN).toMatch(/case 'offscreen_grabFrame'/);
    expect(OFFSCREEN).toMatch(/async function grabSourceFrame/);
    expect(OFFSCREEN).toMatch(/originalDisplayStream\.getVideoTracks\(\)/);
    expect(BACKGROUND).toMatch(/message\.action === 'getSourceFrame'/);
    expect(POPUP).toMatch(/action: 'getSourceFrame'/);
  });

  it('prefers the recorder over the active tab once a source is chosen', () => {
    expect(POPUP).toMatch(/const LIVE_VIEWS = \['countdown', 'recording', 'paused'\]/);
    const fn = POPUP.slice(POPUP.indexOf('async function refreshPreview'));
    // Compare the calls, not the prose: the comment above the branch names
    // captureVisibleTab, which made an earlier version of this pass on text.
    expect(fn.indexOf('LIVE_VIEWS.includes(state.view)'))
      .toBeLessThan(fn.indexOf('chrome.tabs.captureVisibleTab('));
  });

  it('keeps one video element rather than one per frame', () => {
    // Attaching and playing a video per grab costs far more than drawing.
    expect(OFFSCREEN).toMatch(/if \(!previewVideo\) \{/);
    expect(OFFSCREEN).toMatch(/if \(!previewCanvas\) previewCanvas = document\.createElement\('canvas'\)/);
  });

  it('reports nothing rather than a blank frame before the first one arrives', () => {
    // A blank canvas would read as a black screen being recorded.
    expect(OFFSCREEN).toMatch(/if \(!previewVideo\.videoWidth \|\| !previewVideo\.videoHeight\) return null;/);
  });

  it('releases the preview element with the tracks', () => {
    const cleanup = OFFSCREEN.slice(OFFSCREEN.indexOf('function cleanupTracks'));
    expect(cleanup.slice(0, 400)).toMatch(/previewVideo = null;/);
  });

  it('tells the popup when a recording ends somewhere else', () => {
    // Stopping from the in-page bar or Chrome's "Stop sharing" banner left an
    // open popup sitting on a running timer for a finished recording.
    expect(BACKGROUND).toMatch(/notifyPopup\(\{ action: 'recordingStopped' \}\)/);
    expect(POPUP).toMatch(/case 'recordingStopped':/);
  });
});
