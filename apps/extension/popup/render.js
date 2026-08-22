import { derive } from './state.js';
import { icon } from './icons.js';

/** render(state, dispatch) replaces #root and rebinds listeners.
 *
 * Every control the popup has ever shown is produced here, from the state
 * machine's view. popup.html holds no markup of its own — if a control is not
 * in this file it does not exist, which is what makes "mode changes which
 * controls exist, not which are enabled" enforceable. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function header(state) {
  return `
    <div class="sr-popup-header">
      <span class="sr-brand">${icon('videoCamera', 14)}SnapRec</span>
      <span class="sr-brand-meta">
        <span>${esc(state.account ?? '')}</span>
        <button type="button" data-nav="settings" aria-label="Settings" title="Settings">
          ${icon('setting', 14)}
        </button>
      </span>
    </div>`;
}

function modeTabs(state) {
  return `
    <div class="sr-tabs" role="tablist" data-control="mode">
      <button type="button" role="tab" aria-selected="${state.mode === 'record'}" data-mode="record">
        ${icon('videoCamera', 13)}Record
      </button>
      <button type="button" role="tab" aria-selected="${state.mode === 'screenshot'}" data-mode="screenshot">
        ${icon('camera', 13)}Screenshot
      </button>
    </div>`;
}

/** Shows the tab as it is right now, so "this tab" is a fact rather than a
 * promise. Empty on restricted pages, which cannot be captured — the frame
 * stays rather than showing an error the user did not cause. */
function preview(state) {
  return `
    <div class="sr-preview">
      <div class="sr-frame" data-treatment="focused">
        ${state.previewSrc ? `<img class="sr-preview-img" src="${esc(state.previewSrc)}" alt="">` : ''}
        ${['tl', 'tr', 'bl', 'br'].map((c) => `<span class="sr-mark sr-mark-${c}"></span>`).join('')}
      </div>
      ${state.previewUrl ? `<span class="sr-preview-url">${esc(state.previewUrl)}</span>` : ''}
    </div>`;
}

const SOURCES = [
  ['tab', 'This tab', 'chrome'],
  ['window', 'Window', 'desktop'],
  ['screen', 'Screen', 'expand'],
];

function sourceGroup(state) {
  return `
    <div class="sr-radiogroup" role="radiogroup" aria-label="Recording source" data-control="source">
      ${SOURCES.map(([k, label, ic]) => `
        <button type="button" role="radio" aria-checked="${state.source === k}" data-source="${k}">
          ${icon(ic, 13)}${label}
        </button>`).join('')}
    </div>`;
}

function inputRow(state, key, label, ic, detail) {
  const on = state.inputs[key];
  return `
    <div class="sr-input-row" data-control="${key}" data-on="${on}">
      ${icon(ic, 14)}
      <span class="sr-input-label">${label}</span>
      ${detail ? `<span class="sr-input-detail">${esc(detail)}</span>` : ''}
      <button type="button" role="switch" aria-checked="${on}" aria-label="${label}" data-toggle="${key}">
        <span></span>
      </button>
    </div>`;
}

/** Shows the live binding from chrome.commands, or nothing.
 *
 * The prototype prints ⌥⇧R, but that combination has never been bound — the
 * manifest ships Ctrl/Cmd+Shift+1–4, and the user can rebind them in
 * chrome://extensions/shortcuts. Printing a shortcut that does not fire is
 * worse than printing none, so unknown means absent. */
function shortcutChip(state, command) {
  const key = state.shortcuts?.[command];
  return key ? `<span class="sr-shortcut">${esc(key)}</span>` : '';
}

/** The sixth control. A1's rule is "mode, source, microphone, tab audio,
 * camera, capture" — capture counts, which is why it carries data-control. */
function primaryAction(state, d, label, command) {
  return `
    <button type="button" class="sr-primary" data-control="capture"
            data-action="primary" data-tone="${d.primaryTone}">
      ${d.primaryTone === 'coral' ? '<span class="sr-dot"></span>' : ''}${label}
      ${shortcutChip(state, command)}
    </button>`;
}

function viewReady(state, d) {
  return `
    ${header(state)}
    ${modeTabs(state)}
    ${preview(state)}
    ${sourceGroup(state)}
    <div class="sr-inputs">
      ${inputRow(state, 'mic', 'Microphone', 'audio', state.micDevice ?? '')}
      ${inputRow(state, 'tabAudio', 'Tab audio', 'sound', '')}
      ${inputRow(state, 'camera', 'Camera', 'user', state.inputs.camera ? '' : 'off')}
    </div>
    <button type="button" class="sr-options-toggle" data-nav="options">
      ${icon('right', 10)}Recording options
      <span class="sr-options-summary">
        ${state.options.resolution} · ${state.options.countdown}s · auto-zoom ${state.options.autoZoom ? 'on' : 'off'}
      </span>
    </button>
    <div class="sr-footer">
      ${primaryAction(state, d, 'Start recording', 'start-recording')}
      <p class="sr-footnote">Saves to this device. No account needed.</p>
    </div>`;
}

const AREAS = [
  ['visible', 'Visible area', 'Whatever’s on screen, instantly.', 'capture-visible'],
  ['region', 'Select a region', 'Drag a box with live dimensions and a magnifier.', 'capture-region'],
  ['fullpage', 'Full page', 'Scrolls and stitches the whole page, however long.', 'capture-fullpage'],
];

function viewScreenshot(state, d) {
  return `
    ${header(state)}
    ${modeTabs(state)}
    ${preview(state)}
    <div class="sr-areas" data-control="area">
      ${AREAS.map(([k, label, body, command]) => `
        <button type="button" data-area="${k}" aria-pressed="${state.area === k}">
          <span class="sr-area-label">${label}</span>
          <span class="sr-area-body">${body}</span>
          ${shortcutChip(state, command)}
        </button>`).join('')}
    </div>
    <div class="sr-footer">
      ${primaryAction(state, d, 'Capture', 'capture-visible')}
      <p class="sr-footnote">Saves to this device. No account needed.</p>
    </div>`;
}

/* -------------------------------------------------------------- options */

const RESOLUTIONS = ['720p', '1080p', '1440p'];
const FRAME_RATES = ['24', '30', '60'];
const COUNTDOWNS = ['0', '3', '5'];

function optionRow(label, help, control) {
  return `
    <div class="sr-option-row">
      <span class="sr-option-label">${label}${help ? `<span class="sr-option-help">${help}</span>` : ''}</span>
      ${control}
    </div>`;
}

function choice(name, values, current) {
  return `
    <span class="sr-choice" role="radiogroup" aria-label="${name}">
      ${values.map((v) => `
        <button type="button" role="radio" aria-checked="${String(current) === v}"
                data-option="${name}" data-value="${v}">${v}</button>`).join('')}
    </span>`;
}

/** The only place in the extension that reads as an instrument panel: grouped
 * rows, mono values, and a live meter beside the mic select — because this is
 * where a device is being chosen. The meter does not exist on A1. */
function viewOptions(state) {
  return `
    ${header(state)}
    <div class="sr-options-head">
      <span class="sr-options-title">Recording options</span>
      <button type="button" class="sr-done" data-nav="back">Done</button>
    </div>
    <div class="sr-options-scroll">
      ${optionRow('Recording quality', 'Larger files, slower uploads.',
        choice('resolution', RESOLUTIONS, state.options.resolution))}
      ${optionRow('Frame rate', '', choice('fps', FRAME_RATES, '30'))}
      ${optionRow('Countdown', 'A moment to switch tabs.',
        choice('countdown', COUNTDOWNS, state.options.countdown))}
      ${optionRow('Microphone', esc(state.micDevice ?? 'System default'), `
        <span class="sr-meter" data-meter aria-label="Microphone level" role="meter"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.micLevel ?? 0}">
          ${Array.from({ length: 12 }, (_, i) => `
            <span class="sr-meter-bar" data-lit="${(state.micLevel ?? 0) > i * 8}"></span>`).join('')}
        </span>`)}
      ${optionRow('Zoom in on clicks', 'Remove them later in the editor.', `
        <button type="button" role="switch" aria-checked="${state.options.autoZoom}"
                aria-label="Zoom in on clicks" data-option-toggle="autoZoom"><span></span></button>`)}
      ${optionRow('Show the cursor', '', `
        <button type="button" role="switch" aria-checked="${state.options.cursor}"
                aria-label="Show the cursor" data-option-toggle="cursor"><span></span></button>`)}
      ${optionRow('Share anonymous usage data', 'Counts and timings only — never URLs, page content or recordings.', `
        <button type="button" role="switch" aria-checked="${state.options.analytics}"
                aria-label="Share anonymous usage data" data-option-toggle="analytics"><span></span></button>`)}
    </div>`;
}

/* ----------------------------------------------------------- permission */

const INPUT_NAME = { mic: 'Microphone', camera: 'Camera', tabAudio: 'Tab audio' };

/** Permission is not a wall: the prompt occupies the preview area only, so the
 * popup neither resizes nor loses its shortcuts, and the recording path stays
 * open. Cyan, not coral — nothing is wrong yet. */
function viewPermission(state) {
  const name = INPUT_NAME[state.pendingPermission] ?? 'That input';
  return `
    ${header(state)}
    ${modeTabs(state)}
    <div class="sr-notice" aria-live="polite">
      <h1 class="sr-notice-title" data-focus-target tabindex="-1">${name} access needed</h1>
      <p class="sr-notice-body">
        Chrome asks once. Allow it and the recording keeps your narration;
        skip it and everything else still records.
      </p>
      <div class="sr-notice-actions">
        <button type="button" class="sr-notice-primary" data-action="request-permission">
          Ask Chrome now
        </button>
        <button type="button" class="sr-notice-secondary" data-action="proceed-without">
          Record without ${name.toLowerCase()}
        </button>
      </div>
    </div>`;
}

/** What happened, what still works, and three concrete steps. No apology, no
 * blame, no mention of permission APIs. The coral rule is accompanied by the
 * word "blocked" — status never rests on hue alone. */
function viewDenied(state) {
  const name = INPUT_NAME[state.pendingPermission] ?? 'That input';
  return `
    ${header(state)}
    ${modeTabs(state)}
    <div class="sr-notice" data-tone="coral" aria-live="polite">
      <span class="sr-status-word">blocked</span>
      <h1 class="sr-notice-title" data-focus-target tabindex="-1">
        ${name} is blocked for SnapRec
      </h1>
      <p class="sr-notice-body">
        Screen and tab audio still record. To get narration back:
      </p>
      <ol class="sr-steps">
        <li>Click the padlock in the address bar.</li>
        <li>Switch ${name} to Allow.</li>
        <li>Come back and check again.</li>
      </ol>
      <div class="sr-notice-actions">
        <button type="button" class="sr-notice-primary" data-action="recheck">Check again</button>
        <button type="button" class="sr-notice-secondary" data-action="proceed-without">
          Record without ${name.toLowerCase()}
        </button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ countdown */

/** The last moment where nothing has been captured. Esc cancels and writes
 * nothing — said in text, not only bound. */
/** A7-minus-one: waiting for Chrome's own picker.
 *
 * The picker is a browser dialog the extension cannot draw over or dismiss, so
 * this view says what is being waited for and offers the only thing that
 * helps — cancelling. It carries registration marks and no coral: nothing is
 * being captured yet, and coral is reserved for capture that is actually
 * happening. */
function viewArming(state) {
  return `
    ${header(state)}
    <!-- No data-strike: the corner strike fires exactly three times in a
         capture's life, and countdown already owns the first. A fourth here
         would spend the emphasis on waiting for a dialog. -->
    <div class="sr-countdown sr-arming">
      <div class="sr-frame" data-treatment="focused">
        ${['tl', 'tr', 'bl', 'br'].map((c) => `<span class="sr-mark sr-mark-${c}"></span>`).join('')}
        <span class="sr-arming-note">Choose what to share</span>
      </div>
      <p class="sr-countdown-note">Pick a tab, window or screen in Chrome's dialog. Nothing is recorded until you do.</p>
      <button type="button" class="sr-notice-secondary" data-action="cancel">Cancel</button>
    </div>`;
}

function viewCountdown(state) {
  return `
    ${header(state)}
    <div class="sr-countdown" data-strike>
      <div class="sr-frame" data-treatment="coral">
        ${state.previewSrc ? `<img class="sr-preview-img" src="${esc(state.previewSrc)}" alt="">` : ''}
        ${['tl', 'tr', 'bl', 'br'].map((c) => `<span class="sr-mark sr-mark-${c}"></span>`).join('')}
        <span class="sr-numeral" data-over-preview="${state.previewSrc ? 'true' : 'false'}">${state.count}</span>
      </div>
      <p class="sr-countdown-note">Nothing is recorded yet. Esc cancels.</p>
      <button type="button" class="sr-notice-secondary" data-action="cancel">Cancel</button>
    </div>`;
}

/* --------------------------------------------------- recording / paused */

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function liveHeader(state, d) {
  return `
    <div class="sr-popup-header" data-tone="${d.coralTreatment === 'filled' ? 'coral' : 'coral-outline'}">
      <span class="sr-brand">
        ${d.coralTreatment === 'filled' ? '<span class="sr-dot"></span>' : ''}
        ${d.statusWord}
      </span>
      <span class="sr-timer" data-timer aria-live="polite" data-announce-every="10">
        ${fmt(state.elapsed)}
      </span>
    </div>`;
}

function viewRecording(state, d) {
  return `
    ${liveHeader(state, d)}
    ${preview(state)}
    <div class="sr-footer sr-live-actions">
      <button type="button" class="sr-notice-secondary" data-action="pause">
        ${icon('pause', 13)}Pause
      </button>
      <button type="button" class="sr-primary" data-action="stop" data-tone="carbon">Stop</button>
    </div>`;
}

function viewPaused(state, d) {
  return `
    ${liveHeader(state, d)}
    ${preview(state)}
    <div class="sr-footer sr-live-actions">
      <button type="button" class="sr-notice-secondary" data-action="resume">
        ${icon('play', 13)}Resume
      </button>
      <button type="button" class="sr-primary" data-action="stop" data-tone="carbon">Stop</button>
    </div>
    <p class="sr-footnote">Recording resumes from ${fmt(state.elapsed)}.</p>
    <div class="sr-footer" data-separated>
      <button type="button" class="sr-destructive" data-action="discard"
              data-confirm="Discard ${fmt(state.elapsed)} of recording? This cannot be undone.">
        ${icon('delete', 13)}Discard
      </button>
    </div>`;
}

/* ------------------------------------------------------------ finishing */

/** Says the file is being written locally, so a closed popup or a dropped
 * connection cannot lose the capture. Indeterminate, honestly: a sweeping
 * segment, never a fake percentage. */
function viewFinishing(state) {
  return `
    ${header(state)}
    <div class="sr-notice">
      <h1 class="sr-notice-title">Finishing the file</h1>
      <p class="sr-notice-body">
        Writing to this device. It is safe to close this window — nothing is
        uploaded yet.
      </p>
      <span data-sweep aria-label="Working"></span>
    </div>`;
}

/* --------------------------------------------------- capture completion */

/** Mirrors packages/design-system PathSpine. The extension cannot import it,
 * so the treatments are duplicated — and PATH_NODES must stay identical to
 * src/status.ts. Four nodes, always in this order. */
const PATH_NODES = ['on this device', 'uploading', 'saved to library', 'link ready'];

function spine(d, pct) {
  const label = PATH_NODES[Math.min(d.spineCurrent, PATH_NODES.length - 1)];

  return `
    <div class="sr-spine" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${pct ?? 0}" data-announce-every="25"
         aria-valuetext="${label}${d.spineState === 'failed' ? ' — stopped' : ''}">
      ${PATH_NODES.map((node, i) => {
        const done = i < d.spineCurrent;
        const current = i === d.spineCurrent;
        const treatment = !current
          ? (done ? 'done' : 'pending')
          : d.spineState === 'failed' ? 'failed'
          : d.spineState === 'offline' ? 'dashed'
          : 'active';
        const width = done ? 100 : current ? (pct ?? 100) : 0;

        return `
          <div class="sr-spine-col">
            <div class="sr-spine-track">
              <span data-spine-segment="${i}" data-treatment="${treatment}" style="width:${width}%"></span>
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
      ${d.actions.map((a) => `
        <button type="button" data-action-key="${a.key}" aria-label="${a.label}"
                ${a.disabledReason ? `aria-disabled="true" title="${esc(a.disabledReason)}"` : `title="${a.label}"`}
                ${a.destructive ? 'data-destructive' : ''}
                ${a.tone ? `data-tone="${a.tone}"` : ''}>
          ${icon(a.icon, 16)}
        </button>`).join('')}
    </div>`;
}

/** The completion plate. Focused, not editable: registration marks only.
 * Annotate opens the editor, and only there does the media gain handles. */
function completionPlate(state, d, { strike = false, badge = '' } = {}) {
  return `
    <div class="sr-completion">
      <div class="sr-plate" ${strike ? 'data-strike' : ''}>
        <div class="sr-frame" data-treatment="focused">
          ${['tl', 'tr', 'bl', 'br'].map((c) => `<span class="sr-mark sr-mark-${c}"></span>`).join('')}
          ${badge ? `<span class="sr-plate-badge">${badge}</span>` : ''}
        </div>
      </div>
      ${edgeRail(d)}
    </div>`;
}

/** No Copy link yet: there is no link, so no button pretends there is. The
 * primary action names its outcome. */
function viewComplete(state, d) {
  return `
    ${header(state)}
    <h1 class="sr-completion-title">Recording finished</h1>
    ${completionPlate(state, d, { strike: d.strikesCorners })}
    ${spine(d)}
    <div class="sr-footer sr-completion-actions">
      <button type="button" class="sr-primary" data-action="primary" data-tone="cyan">
        ${icon('cloudUpload', 15)}Upload and get link
      </button>
      <div class="sr-secondary-pair">
        <button type="button" class="sr-notice-secondary" data-action="save-library">Save to library</button>
        <button type="button" class="sr-notice-secondary" data-action="annotate">Annotate</button>
      </div>
    </div>`;
}

/** Progress in two places, one meaning: a cyan rule fills along the media's
 * bottom edge and the same percentage advances the spine. Bytes are named. */
function viewUploading(state, d) {
  const pct = state.upload.pct;
  const total = state.capture?.bytes ?? 0;
  return `
    ${header(state)}
    <h1 class="sr-completion-title">Uploading</h1>
    ${completionPlate(state, d)}
    ${spine(d, pct)}
    <p class="sr-upload-label">${pct}% · ${MB(total * pct / 100)} of ${MB(total)} MB</p>
    <div class="sr-footer">
      <button type="button" class="sr-notice-secondary" data-action="cancel">Cancel upload</button>
      <p class="sr-footnote">Closing this window does not stop the upload.</p>
    </div>`;
}

/** Cause, reassurance, two next actions. The file's safety is stated before
 * anything else. Retry is carbon — a normal action, not an emergency. */
function viewUploadFailed(state, d) {
  return `
    ${header(state)}
    <span class="sr-status-word">stopped</span>
    <h1 class="sr-completion-title">Upload stopped</h1>
    ${completionPlate(state, d)}
    ${spine(d, state.upload.pct)}
    <p class="sr-failure-body" data-failure-body>
      Your recording is still on this device. The connection dropped at
      ${state.upload.failedAt ?? 0}%, so nothing was lost — the upload can pick
      up where it stopped.
    </p>
    <div class="sr-footer sr-completion-actions">
      <button type="button" class="sr-primary" data-action="primary" data-tone="carbon">Try again</button>
      <button type="button" class="sr-notice-secondary" data-action="save-local">Keep it local</button>
    </div>`;
}

/** Not an error: neutral grey and a dashed segment, never coral. Nothing has
 * failed; the work is simply waiting. */
function viewOffline(state, d) {
  return `
    ${header(state)}
    <span class="sr-status-word" data-tone="neutral">queued</span>
    <h1 class="sr-completion-title">Waiting for a connection</h1>
    ${completionPlate(state, d)}
    ${spine(d)}
    <p class="sr-completion-body">
      This will upload by itself when you are back online. You can close this
      window — the capture is on your device either way.
    </p>
    <div class="sr-footer">
      <button type="button" class="sr-notice-secondary" data-action="download">Download now</button>
    </div>`;
}

/** Uploaded is not shared: three nodes complete, the fourth explicitly reads
 * "no link yet", and the media carries a private badge. */
function viewSaved(state, d) {
  return `
    ${header(state)}
    <h1 class="sr-completion-title">Saved to your library</h1>
    ${completionPlate(state, d, { badge: 'private' })}
    ${spine(d)}
    <p class="sr-completion-body">
      In your library and backed up — but <strong>no link yet</strong>. Sharing
      stays a deliberate act.
    </p>
    <div class="sr-footer">
      <button type="button" class="sr-primary" data-action="primary" data-tone="cyan">
        ${icon('link', 15)}Create share link
      </button>
    </div>`;
}

/** Now Copy link exists — in two places at once, the edge rail's first slot and
 * the field. Permissions sit next to the link, not behind a settings screen,
 * because both are decisions made at the moment of sharing. */
function viewLinkReady(state, d) {
  return `
    ${header(state)}
    <h1 class="sr-completion-title">Link ready</h1>
    ${completionPlate(state, d, { strike: d.strikesCorners })}
    ${spine(d)}
    <div class="sr-link-row">
      <input type="text" readonly data-link-field value="${esc(state.link ?? '')}"
             aria-label="Share link">
      <button type="button" class="sr-notice-primary" data-action="copy-link">Copy</button>
    </div>
    <div class="sr-permissions">
      <label class="sr-permission">
        <span>Who can see it</span>
        <select data-permission="visibility">
          <option value="link">Anyone with the link</option>
          <option value="restricted">Only people I invite</option>
        </select>
      </label>
      <label class="sr-permission">
        <span>Allow download</span>
        <button type="button" role="switch" aria-checked="true"
                aria-label="Allow download" data-permission="download"><span></span></button>
      </label>
    </div>`;
}

const VIEWS = {
  ready: viewReady,
  screenshot: viewScreenshot,
  options: viewOptions,
  complete: viewComplete,
  uploading: viewUploading,
  uploadFailed: viewUploadFailed,
  offline: viewOffline,
  saved: viewSaved,
  linkReady: viewLinkReady,
  permission: viewPermission,
  denied: viewDenied,
  arming: viewArming,
  countdown: viewCountdown,
  recording: viewRecording,
  paused: viewPaused,
  finishing: viewFinishing,
};

export function render(state, dispatch, effects = {}) {
  const root = document.getElementById('root');
  const view = VIEWS[state.view];
  if (!view) throw new Error(`no renderer for view: ${state.view}`);

  root.innerHTML = view(state, derive(state));
  bind(root, dispatch, effects);
}

const on = (root, selector, build) => {
  root.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', () => build(el));
  });
};

function bind(root, dispatch, effects = {}) {
  on(root, '[data-mode]', (el) => dispatch({ type: 'SET_MODE', mode: el.dataset.mode }));
  on(root, '[data-source]', (el) => dispatch({ type: 'SET_SOURCE', source: el.dataset.source }));
  on(root, '[data-area]', (el) => dispatch({ type: 'SET_AREA', area: el.dataset.area }));
  on(root, '[data-toggle]', (el) => dispatch({ type: 'TOGGLE_INPUT', input: el.dataset.toggle }));
  on(root, '[data-nav="options"]', () => dispatch({ type: 'OPEN_OPTIONS' }));
  on(root, '[data-nav="settings"]', () => dispatch({ type: 'OPEN_OPTIONS' }));
  on(root, '[data-nav="back"]', () => dispatch({ type: 'BACK' }));
  on(root, '[data-action="primary"]', () => {
    // A screenshot fires immediately; only recording goes through the machine.
    if (root.querySelector('[data-area]')) effects.captureScreenshot?.();
    else dispatch({ type: 'START' });
  });
  on(root, '[data-action="cancel"]', () => dispatch({ type: 'CANCEL' }));
  on(root, '[data-action="pause"]', () => dispatch({ type: 'PAUSE' }));
  on(root, '[data-action="resume"]', () => dispatch({ type: 'RESUME' }));
  on(root, '[data-action="stop"]', () => dispatch({ type: 'STOP' }));
  on(root, '[data-action="proceed-without"]', () => dispatch({ type: 'PERMISSION_GRANTED' }));
  on(root, '[data-option]', (el) =>
    dispatch({ type: 'SET_OPTION', key: el.dataset.option, value: el.dataset.value }));
  on(root, '[data-option-toggle]', (el) =>
    dispatch({ type: 'TOGGLE_OPTION', key: el.dataset.optionToggle }));

  // request-permission, recheck and discard are side effects popup.js owns —
  // they need chrome.permissions and a confirm dialog, so they carry no
  // dispatch here. bind() stays free of chrome.* on purpose.
}
