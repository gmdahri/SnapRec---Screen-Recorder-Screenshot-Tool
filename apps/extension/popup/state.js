/** The popup is a state machine, not a set of panels.
 *
 * This module is PURE — no chrome.* calls, no DOM. popup.js owns every side
 * effect. That is what makes the fifteen views testable in jsdom, and it is the
 * only reason this file exists separately from render.js.
 *
 * `derive` is where the design rules live — coral reservation, the three-strike
 * limit, no-link-no-button, offline-is-not-failure. Keeping them here rather
 * than in the renderer is what stops each view re-deciding them. */

export const VIEWS = [
  'ready', 'screenshot', 'options', 'permission', 'denied',
  'arming', 'countdown', 'recording', 'paused', 'finishing',
  'complete', 'uploading', 'uploadFailed', 'offline', 'saved', 'linkReady',
];

export function initialState() {
  return {
    view: 'ready',
    /** True only on the transition that changed `view`. The corner strike
     * fires on ENTRY to a view, not while sitting in it: deriving it from
     * `view` alone restrikes on every countdown tick, and remembering the
     * previous view does not help because that stays stale between changes. */
    entered: false,
    mode: 'record',
    source: 'tab',
    area: 'visible',
    inputs: { mic: true, tabAudio: true, camera: false },
    /* `analytics` is the user-facing sense of the flag: true means "share
     * anonymous usage data". The background stores the inverse
     * (analyticsOptOut) because opt-out is the thing that has to survive a
     * missing value — absent means not opted out. popup.js translates at the
     * boundary; nothing else needs to know. Seeded from storage in boot(). */
    options: { resolution: '1080p', countdown: 3, autoZoom: true, cursor: true, analytics: true },
    count: 0,
    elapsed: 0,
    /** The recorder's own start time, once it is running. Null until then. */
    startTime: null,
    capture: null,
    upload: { pct: 0, bytes: 0, failedAt: null, reason: null },
    link: null,
    pendingPermission: null,
    returnTo: 'ready',
    account: null,
    micDevice: null,
    micLevel: 0,
    previewUrl: null,
    /** Live keyboard bindings from chrome.commands.getAll(), keyed by command
     * name. Null until they resolve — the popup shows no shortcut rather than
     * a guessed one, because the user can rebind these in chrome://extensions
     * and a stale hint is worse than none. */
    shortcuts: null,
  };
}

/** Whole seconds since a recorder start time. Floors, so the popup never reads
 * a second ahead of the file. */
export function elapsedSince(startTime, now = Date.now()) {
  if (!startTime) return 0;
  return Math.max(0, Math.floor((now - startTime) / 1000));
}

const set = (s, patch) => ({
  ...s,
  ...patch,
  entered: patch.view !== undefined && patch.view !== s.view,
});

export function transition(state, event) {
  switch (event.type) {
    case 'SET_MODE':
      return set(state, {
        view: event.mode === 'screenshot' ? 'screenshot' : 'ready',
        mode: event.mode,
      });

    case 'SET_SOURCE':
      return set(state, { source: event.source });

    case 'SET_AREA':
      return set(state, { area: event.area });

    case 'SET_OPTION': {
      const value = event.key === 'countdown' ? Number(event.value) : event.value;
      return set(state, { options: { ...state.options, [event.key]: value } });
    }

    case 'TOGGLE_OPTION':
      return set(state, {
        options: { ...state.options, [event.key]: !state.options[event.key] },
      });

    case 'TOGGLE_INPUT':
      return set(state, {
        inputs: { ...state.inputs, [event.input]: !state.inputs[event.input] },
      });

    case 'OPEN_OPTIONS':
      return set(state, { view: 'options', returnTo: state.view });

    case 'BACK':
      return set(state, { view: state.returnTo });

    case 'START':
      // A screenshot is instantaneous — there is nothing to count down to, and
      // the capture fires immediately. Only recording gets a countdown.
      if (state.mode === 'screenshot') return state;
      // NOT countdown: Chrome's "choose what to share" picker opens next, and
      // nothing is being captured until it is answered. Counting down here —
      // and then showing a running timer — told people they were recording
      // while the picker was still open and the screen untouched.
      return set(state, { view: 'arming' });

    /** The picker has been answered and a source is chosen. */
    case 'SOURCE_PICKED':
      return state.view === 'arming'
        ? set(state, { view: 'countdown', count: state.options.countdown })
        : state;

    /** The recorder is actually running. `startTime` is the recorder's own, so
     * the timer matches the file rather than counting from whenever the popup
     * happened to notice. */
    case 'RECORDING_STARTED':
      return set(state, {
        view: 'recording',
        count: 0,
        elapsed: elapsedSince(event.startTime),
        startTime: event.startTime ?? null,
      });

    /** The picker was dismissed, or the source could not be captured. */
    case 'START_FAILED':
      return set(state, { view: state.mode === 'screenshot' ? 'screenshot' : 'ready', count: 0, elapsed: 0 });

    case 'TICK': {
      if (state.view === 'countdown') {
        const next = state.count - 1;
        // Reaching zero no longer starts the recording on its own — the
        // background says when the recorder is live. The countdown just holds
        // at zero until it does, so the timer can never run ahead of the file.
        return set(state, { count: Math.max(0, next) });
      }
      if (state.view === 'recording') {
        // Derived from the recorder's start time when there is one, so a popup
        // that was closed for a minute reopens showing the true elapsed rather
        // than resuming its own count.
        return set(state, {
          elapsed: state.startTime ? elapsedSince(state.startTime) : state.elapsed + 1,
        });
      }
      // Paused freezes the timer; every other view ignores ticks entirely.
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
      // Resume from the failure point rather than restarting: the user watched
      // it reach 62% once and should not watch that again.
      return set(state, {
        view: 'uploading',
        upload: {
          ...state.upload,
          pct: state.upload.failedAt ?? state.upload.pct,
          failedAt: null,
          reason: null,
        },
      });

    case 'UPLOAD_PROGRESS':
      return set(state, {
        upload: { ...state.upload, pct: event.pct, bytes: event.bytes },
      });

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
      if (state.view === 'arming' || state.view === 'countdown') {
        return set(state, {
          view: state.mode === 'screenshot' ? 'screenshot' : 'ready',
          count: 0,
          elapsed: 0,
        });
      }
      // Cancelling an upload leaves the file exactly as it was.
      if (state.view === 'uploading') return set(state, { view: 'complete' });
      return state;

    case 'PERMISSION_REQUIRED':
      return set(state, {
        view: 'permission',
        pendingPermission: event.input,
        returnTo: state.view,
      });

    case 'PERMISSION_DENIED':
      return set(state, { view: 'denied', pendingPermission: event.input });

    case 'PERMISSION_GRANTED':
      return set(state, { view: state.returnTo, pendingPermission: null });

    default:
      return state;
  }
}

const STRIKE_VIEWS = new Set(['countdown', 'complete', 'linkReady']);
const CAPTURING = new Set(['recording', 'paused', 'finishing']);
const COMPLETION = new Set(['complete', 'uploading', 'uploadFailed', 'offline', 'saved', 'linkReady']);

const PRIMARY_LABEL = {
  ready: 'Start recording',
  screenshot: 'Capture',
  complete: 'Upload and get link',
  uploading: 'Cancel upload',
  uploadFailed: 'Try again',
  offline: 'Download now',
  saved: 'Create share link',
  linkReady: 'Copy link',
};

const STATUS_WORD = {
  recording: 'recording',
  paused: 'paused',
  finishing: 'finishing',
  denied: 'blocked',
  uploadFailed: 'stopped',
  offline: 'queued',
  saved: 'private',
  linkReady: 'link ready',
  uploading: 'uploading',
  complete: 'on this device',
};

const SPINE_CURRENT = {
  complete: 0, uploading: 1, uploadFailed: 1, offline: 1, saved: 2, linkReady: 3,
};

/** While bytes are moving, some edge actions genuinely cannot run. Each one
 * says when it comes back rather than sitting there inert — a disabled control
 * with no reason is a dead end. */
const UPLOADING_BLOCKED = {
  annotate: 'Available once the upload finishes',
  drive: 'Available once the upload finishes',
  discard: 'Cancel the upload first',
};

function actionsFor(view) {
  if (!COMPLETION.has(view)) return [];

  const actions = [];
  // Copy link exists only once there is a link. No button pretends otherwise.
  if (view === 'linkReady') {
    actions.push({ key: 'copyLink', label: 'Copy link', icon: 'link', tone: 'cyan' });
  }
  actions.push({ key: 'copy', label: 'Copy', icon: 'copy' });
  actions.push({ key: 'download', label: 'Download', icon: 'download' });
  actions.push({ key: 'annotate', label: 'Annotate', icon: 'scissor' });
  // The rail changes with capability: once the capture is in the library the
  // Drive slot becomes Move to collection.
  actions.push(
    view === 'saved' || view === 'linkReady'
      ? { key: 'move', label: 'Move to collection', icon: 'folder' }
      : { key: 'drive', label: 'Save to Google Drive', icon: 'cloudUpload' },
  );
  actions.push({ key: 'discard', label: 'Discard', icon: 'delete', destructive: true });

  if (view === 'uploading') {
    return actions.map((a) =>
      (UPLOADING_BLOCKED[a.key] ? { ...a, disabledReason: UPLOADING_BLOCKED[a.key] } : a));
  }
  return actions;
}

/** Everything the renderer needs, derived — never stored. */
export function derive(state) {
  const v = state.view;

  return {
    view: v,
    actions: actionsFor(v),
    primaryLabel: PRIMARY_LABEL[v] ?? null,

    /** A screenshot is instantaneous, so its action is carbon. Withholding
     * coral here is what makes the countdown's coral mean something. */
    primaryTone: v === 'ready' ? 'coral' : 'carbon',

    /** Mode changes which controls exist, not which are enabled — nothing
     * disabled is left on screen to be puzzled over. */
    showsAudioInputs: state.mode === 'record',

    /** Filled coral = capturing right now. Paused keeps the boundary and
     * empties the fill, so a screenshot of the popup still distinguishes them. */
    coralTreatment: v === 'recording' ? 'filled' : v === 'paused' ? 'outline' : 'none',

    usesCoral:
      v === 'recording' || v === 'paused' || v === 'countdown'
      || v === 'denied' || v === 'uploadFailed',

    /** The countdown is the last moment where nothing has been captured. */
    hasWrittenBytes: CAPTURING.has(v),

    /** Fires exactly three times in a capture's life: countdown, completion,
     * link resolution. Nowhere else, ever — and once per entry, so the
     * countdown's ticks do not restrike it. */
    strikesCorners: STRIKE_VIEWS.has(v) && state.entered,

    spineState: v === 'uploadFailed' ? 'failed' : v === 'offline' ? 'offline' : 'normal',
    spineCurrent: SPINE_CURRENT[v] ?? 0,
    breakAt: state.upload.failedAt,

    /** Status never rests on hue alone. */
    statusWord: STATUS_WORD[v] ?? null,

    /** Permission is not a wall — the recording path stays open. */
    canProceedWithout: v === 'permission' || v === 'denied',

    canStart: v === 'ready' || v === 'screenshot',

    /** A sweeping segment, never a fake percentage. Percentages appear only
     * once bytes are measurable, at upload. */
    indeterminate: v === 'finishing',
  };
}
