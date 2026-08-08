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

function preview(state) {
  return `
    <div class="sr-preview">
      <div class="sr-frame" data-treatment="focused">
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

const VIEWS = {
  ready: viewReady,
  screenshot: viewScreenshot,
};

export function render(state, dispatch) {
  const root = document.getElementById('root');
  const view = VIEWS[state.view];
  if (!view) throw new Error(`no renderer for view: ${state.view}`);

  root.innerHTML = view(state, derive(state));
  bind(root, dispatch);
}

const on = (root, selector, build) => {
  root.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', () => build(el));
  });
};

function bind(root, dispatch) {
  on(root, '[data-mode]', (el) => dispatch({ type: 'SET_MODE', mode: el.dataset.mode }));
  on(root, '[data-source]', (el) => dispatch({ type: 'SET_SOURCE', source: el.dataset.source }));
  on(root, '[data-area]', (el) => dispatch({ type: 'SET_AREA', area: el.dataset.area }));
  on(root, '[data-toggle]', (el) => dispatch({ type: 'TOGGLE_INPUT', input: el.dataset.toggle }));
  on(root, '[data-nav="options"]', () => dispatch({ type: 'OPEN_OPTIONS' }));
  on(root, '[data-nav="back"]', () => dispatch({ type: 'BACK' }));
  on(root, '[data-action="primary"]', () => dispatch({ type: 'START' }));
  on(root, '[data-action="cancel"]', () => dispatch({ type: 'CANCEL' }));
}
