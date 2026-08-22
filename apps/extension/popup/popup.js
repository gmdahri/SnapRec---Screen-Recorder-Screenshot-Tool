import { derive, initialState, transition } from './state.js';
import { render } from './render.js';
// Analytics: the popup never owns a PostHog client — see popup/analytics.js.
import { getOptOut, setOptOut } from './analytics.js';

/** Wires the pure state machine to Chrome.
 *
 * Every chrome.* call in the popup lives here. state.js and render.js stay
 * testable in jsdom precisely because neither of them knows Chrome exists.
 *
 * The background service worker speaks { action: '...' } — not { type: '...' }.
 * Do not "modernise" that here without changing background.js with it. */

let state = initialState();
let timer = null;

function dispatch(event) {
  const next = transition(state, event);
  if (next === state) return;
  const previous = state;
  state = next;
  paint();
  runSideEffects(event, previous);
}

function paint() {
  render(state, dispatch, { captureScreenshot });

  // Focus management the state machine cannot own, because it has no DOM.
  document.querySelector('[data-focus-target]')?.focus();

  clearInterval(timer);
  timer = null;
  if (state.view === 'countdown' || state.view === 'recording') {
    timer = setInterval(() => dispatch({ type: 'TICK' }), 1000);
  }
}

const send = (message) =>
  new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response);
      });
    } catch {
      resolve(undefined);
    }
  });

/** Must match the `case` labels in background.js — there is no shared
 * constant, so a typo here fails silently as a no-op message. */
const AREA_ACTION = {
  visible: 'captureVisible',
  region: 'captureRegion',
  fullpage: 'captureFullPage',
};

function runSideEffects(event, previous) {
  switch (event.type) {
    case 'START':
      send({
        action: 'startRecording',
        options: {
          source: state.source,
          microphone: state.inputs.mic,
          systemAudio: state.inputs.tabAudio,
          webcam: state.inputs.camera,
        },
      });
      break;

    case 'STOP':
      send({ action: 'stopRecording' });
      break;

    // These reached the state machine but never the recorder, so the popup
    // showed paused while the recording kept running.
    case 'PAUSE':
      send({ action: 'pauseRecording' });
      break;

    case 'RESUME':
      send({ action: 'resumeRecording' });
      break;

    case 'CANCEL':
      // Arming means Chrome's picker is up; the extension cannot dismiss it,
      // so the honest thing is to stop the attempt behind it and let the user
      // dismiss the dialog.
      if (previous.view === 'arming') send({ action: 'stopRecording' });
      if (previous.view === 'countdown') send({ action: 'cancelCountdown' });
      if (previous.view === 'uploading') send({ action: 'cancelUpload', id: state.capture?.id });
      break;

    case 'UPLOAD':
      send({ action: 'uploadCapture', id: state.capture?.id });
      break;

    // The picker has been answered: show what was picked, once.
    case 'SOURCE_PICKED':
      showChosenSource();
      break;

    // Recording is under way, and the in-page bar owns pause and stop from
    // here. The popup steps out of the way rather than sitting over the thing
    // being recorded — which is also why there is no live preview in it.
    case 'RECORDING_STARTED':
      clearInterval(previewTimer);
      clearInterval(timer);
      window.close();
      break;

    // The camera toggle used to change nothing but its own switch — you found
    // out whether the camera worked, and where it sat, only after the
    // recording had already started. It now puts a live overlay on the page
    // immediately, so framing happens before the take.
    // The analytics switch is the only option that persists outside the popup:
    // the background reads it before every event. state.options.analytics is
    // already the NEW value here, and the stored flag is its inverse.
    case 'TOGGLE_OPTION':
      if (event.key === 'analytics') setOptOut(!state.options.analytics);
      break;

    case 'TOGGLE_INPUT':
      if (event.input === 'camera') {
        send({ action: 'setWebcamPreview', enabled: state.inputs.camera });
      }
      // The overlay carries a mic button too, so both write to one store
      // rather than each keeping its own idea of the setting.
      if (event.input === 'mic') {
        send({ action: 'setMicMuted', muted: !state.inputs.mic });
      }
      break;

    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  switch (message?.action) {
    // The capture lifecycle, from the only place that knows it. The popup used
    // to run its own countdown and timer the moment Start was pressed, so it
    // showed "recording 0:06" while Chrome's picker was still open.
    case 'sourcePicked': dispatch({ type: 'SOURCE_PICKED' }); break;
    case 'recordingStarted': dispatch({ type: 'RECORDING_STARTED', startTime: message.startTime }); break;
    case 'startFailed': dispatch({ type: 'START_FAILED', reason: message.reason }); break;
    case 'recordingStopped':
      // Only from a live view: this is also broadcast at the end of a stop the
      // popup itself began, and STOP from `finishing` would be a no-op anyway.
      if (['arming', 'countdown', 'recording', 'paused'].includes(state.view)) {
        dispatch({ type: 'STOP' });
      }
      break;
    case 'captureFinished': dispatch({ type: 'FINISHED', capture: message.capture }); break;
    case 'uploadProgress': dispatch({ type: 'UPLOAD_PROGRESS', pct: message.pct, bytes: message.bytes }); break;
    case 'uploadFailed': dispatch({ type: 'UPLOAD_FAILED', reason: message.reason, at: message.at }); break;
    case 'uploadQueued': dispatch({ type: 'OFFLINE' }); break;
    case 'uploadSaved': dispatch({ type: 'SAVED' }); break;
    case 'linkReady': dispatch({ type: 'LINK_READY', url: message.url }); break;
    case 'permissionRequired': dispatch({ type: 'PERMISSION_REQUIRED', input: message.input }); break;
    case 'permissionDenied': dispatch({ type: 'PERMISSION_DENIED', input: message.input }); break;
    default: break;
  }
});

/** Fires a screenshot. Not routed through the state machine: START no longer
 * transitions in screenshot mode, because there is nothing to count down to
 * and the popup closes the instant the capture starts. */
function captureScreenshot() {
  send({ action: AREA_ACTION[state.area] ?? 'captureVisible' });
  window.close();
}

/** A real view of what will be captured.
 *
 * chrome.tabs.captureVisibleTab is rate-limited to a couple of calls a second,
 * so this refreshes on a slow interval rather than per frame — enough to track
 * the tab, cheap enough not to fight the limit. Opening the popup is the user
 * gesture that grants activeTab. */
let previewTimer = null;

/** One still of whatever the user just chose in Chrome's picker.
 *
 * Deliberately a single frame, not a feed. A live rebroadcast of the capture
 * inside the popup is both pointless — you are looking at the thing being
 * recorded — and a second copy of the screen to keep encoding. This exists
 * only to answer "did I pick the right one", so it is grabbed once, when the
 * picker is answered, and left alone. */
async function showChosenSource(attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const frame = await send({ action: 'getSourceFrame', maxWidth: 320 });
    if (frame?.dataUrl) {
      state = { ...state, previewSrc: frame.dataUrl, previewUrl: null };
      paint();
      return;
    }
    // Bounded, and short: the countdown is only three seconds, and a still
    // that arrives after the popup has closed helps nobody.
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function refreshPreview() {
  if (state.mode !== 'record' && state.mode !== 'screenshot') return;

  // The live tab preview belongs to the pre-capture views only. Once a source
  // is chosen the popup shows the still from showChosenSource, and once the
  // recording starts the popup closes.
  if (!['ready', 'screenshot'].includes(state.view)) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Never preview ourselves. chrome.tabs.getCurrent() resolves to a tab only
    // when this page IS one — as a real toolbar popup it is undefined. Opened
    // as a tab while debugging, the preview would otherwise show a recursive
    // picture of the popup instead of the page. Checking tab.url is not enough:
    // without the activeTab grant that field is undefined.
    const own = await chrome.tabs.getCurrent().catch(() => undefined);
    if (own && own.id === tab.id) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg', quality: 60,
    });

    let host = null;
    try { host = tab.url ? new URL(tab.url).host : null; } catch { host = null; }

    state = { ...state, previewSrc: dataUrl, previewUrl: host };
    paint();
  } catch {
    // Restricted pages (chrome://, the Web Store) cannot be captured. Leave the
    // frame empty rather than showing an error for something the user did not
    // do wrong — the capture itself will explain if they try.
  }
}

/** Paused → Discard. Names the duration being lost before doing it. */
function discardRecording(confirmText) {
  if (confirmText && !window.confirm(confirmText)) return;
  send({ action: 'stopRecording', discard: true });
  state = initialState();
  paint();
}

document.addEventListener('click', (e) => {
  const discard = e.target.closest?.('[data-action="discard"]');
  if (discard) discardRecording(discard.dataset.confirm);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.view === 'countdown' || state.view === 'uploading') dispatch({ type: 'CANCEL' });
});

/** Read the real key bindings. The user can rebind these, so the popup never
 * guesses — an unknown binding renders as no hint at all. */
async function loadShortcuts() {
  if (!chrome.commands?.getAll) return;
  const commands = await chrome.commands.getAll();
  const shortcuts = {};
  for (const c of commands) if (c.name && c.shortcut) shortcuts[c.name] = c.shortcut;
  state = { ...state, shortcuts };
}

/** Read the stored analytics preference so the switch shows the real state
 * rather than the default the moment the options view is opened. */
async function loadAnalyticsPreference() {
  const optedOut = await getOptOut();
  state = { ...state, options: { ...state.options, analytics: !optedOut } };
}

async function boot() {
  await loadShortcuts();
  await loadAnalyticsPreference();

  // The popup is closed and reopened constantly and must never show `ready`
  // while a recording is running.
  const live = await send({ action: 'getCaptureState' });
  if (live?.view === 'recording') {
    // transition, not dispatch: dispatch would run the RECORDING_STARTED side
    // effect and close the popup the instant it was reopened.
    state = transition(state, { type: 'RECORDING_STARTED', startTime: live.startTime });
  } else if (live) {
    state = { ...state, ...live };
  }

  // The overlay outlives the popup, which is rebuilt from initialState() every
  // time it opens. Without this the camera could be running on the page while
  // this switch read "off" — the toggle would then need two clicks to turn
  // something off that was already on.
  const cam = await send({ action: 'getWebcamPreview' });
  if (cam && typeof cam.on === 'boolean') {
    state = { ...state, inputs: { ...state.inputs, camera: cam.on } };
  }

  const mic = await send({ action: 'getMicMuted' });
  if (mic && typeof mic.muted === 'boolean') {
    state = { ...state, inputs: { ...state.inputs, mic: !mic.muted } };
  }

  paint();

  // Reopened mid-recording: one still of the source, so the frame is not an
  // empty box. Still one frame, never a feed.
  if (state.view === 'recording') {
    await showChosenSource();
    return;
  }

  await refreshPreview();
  previewTimer = setInterval(refreshPreview, 1500);
}

window.addEventListener('unload', () => {
  clearInterval(previewTimer);
  clearInterval(timer);
});

boot();

// Exported for the console while debugging; not part of any contract.
globalThis.__snaprecPopup = { get state() { return state; }, derive: () => derive(state) };
