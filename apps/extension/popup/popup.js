import { derive, initialState, transition } from './state.js';
import { render } from './render.js';

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
  render(state, dispatch);

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

const AREA_ACTION = {
  visible: 'captureVisible',
  region: 'startRegionSelect',
  fullpage: 'captureFullPage',
};

function runSideEffects(event, previous) {
  switch (event.type) {
    case 'START':
      if (previous.mode === 'screenshot') {
        send({ action: AREA_ACTION[previous.area ?? 'visible'] });
        window.close();
        return;
      }
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

    case 'CANCEL':
      if (previous.view === 'countdown') send({ action: 'cancelCountdown' });
      if (previous.view === 'uploading') send({ action: 'cancelUpload', id: state.capture?.id });
      break;

    case 'UPLOAD':
      send({ action: 'uploadCapture', id: state.capture?.id });
      break;

    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  switch (message?.action) {
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

async function boot() {
  await loadShortcuts();

  // The popup is closed and reopened constantly and must never show `ready`
  // while a recording is running.
  const live = await send({ action: 'getCaptureState' });
  if (live) state = { ...state, ...live };

  paint();
}

boot();

// Exported for the console while debugging; not part of any contract.
globalThis.__snaprecPopup = { get state() { return state; }, derive: () => derive(state) };
