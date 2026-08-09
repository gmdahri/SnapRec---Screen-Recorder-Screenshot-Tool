import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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
    expect(mount(initialState()).querySelector('[data-meter]')).toBeNull();
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

  it('names the live keyboard binding in text, not only as a binding', () => {
    const withKeys = { ...initialState(), shortcuts: { 'start-recording': 'Cmd+Shift+4' } };
    expect(mount(withKeys).textContent).toContain('Cmd+Shift+4');
  });

  it('shows no shortcut at all until the real binding is known', () => {
    // The user can rebind these in chrome://extensions/shortcuts, so a guessed
    // hint would be a lie. Absent beats wrong.
    const root = mount(initialState());
    expect(root.querySelector('.sr-shortcut')).toBeNull();
  });

  it('states where the capture goes', () => {
    expect(mount(initialState()).textContent)
      .toContain('Saves to this device. No account needed.');
  });

  it('renders the capture action in coral, because recording is live', () => {
    expect(mount(initialState()).querySelector('[data-action="primary"]').dataset.tone)
      .toBe('coral');
  });

  it('dispatches a mode change', async () => {
    const dispatch = vi.fn();
    const root = mount(initialState(), dispatch);
    root.querySelector('[data-mode="screenshot"]').click();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'screenshot' });
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
    const withKeys = {
      ...shot,
      shortcuts: {
        'capture-visible': 'Cmd+Shift+3',
        'capture-region': 'Cmd+Shift+2',
        'capture-fullpage': 'Cmd+Shift+1',
      },
    };
    const areas = mount(withKeys).querySelectorAll('[data-area]');
    expect(areas).toHaveLength(3);
    for (const a of areas) expect(a.textContent).toMatch(/Cmd\+Shift\+\d/);
  });

  it('does not render the capture action in coral', () => {
    expect(mount(shot).querySelector('[data-action="primary"]').dataset.tone).toBe('carbon');
  });
});

const recording = (startTime = Date.now()) =>
  [{ type: 'START' }, { type: 'SOURCE_PICKED' }, { type: 'RECORDING_STARTED', startTime }]
    .reduce(transition, initialState());

describe('recording options (A3)', () => {
  const opts = transition(initialState(), { type: 'OPEN_OPTIONS' });

  it('is the only view with a meter, because a device is being chosen here', () => {
    expect(mount(opts).querySelector('[data-meter]')).toBeTruthy();
    expect(mount(initialState()).querySelector('[data-meter]')).toBeNull();
  });

  it('uses fixed rows so the layout holds at 125% browser zoom', () => {
    expect(mount(opts).querySelectorAll('.sr-option-row').length).toBeGreaterThan(0);
  });

  it('keeps the header and Done fixed while the panel scrolls', () => {
    const root = mount(opts);
    expect(root.querySelector('.sr-options-scroll')).toBeTruthy();
    expect(root.querySelector('[data-nav="back"]')).toBeTruthy();
  });
});

describe('permission (A4) and denial (A5)', () => {
  const required = transition(initialState(), { type: 'PERMISSION_REQUIRED', input: 'mic' });
  const denied = transition(required, { type: 'PERMISSION_DENIED', input: 'mic' });

  it('keeps the recording path open and offers to proceed without', () => {
    expect(mount(required).querySelector('[data-action="proceed-without"]')).toBeTruthy();
  });

  it('moves focus to the heading and announces it', () => {
    const root = mount(required);
    const h = root.querySelector('[data-focus-target]');
    expect(h).toBeTruthy();
    expect(h.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it('names the state in words alongside the coral rule', () => {
    expect(mount(denied).textContent).toContain('blocked');
  });

  it('offers a re-check that does not require a reload', () => {
    expect(mount(denied).querySelector('[data-action="recheck"]')).toBeTruthy();
  });

  it('mentions no permission API and offers no apology', () => {
    const text = mount(denied).textContent.toLowerCase();
    expect(text).not.toContain('permission api');
    expect(text).not.toContain('sorry');
    expect(text).not.toContain('getusermedia');
  });
});

describe('waiting for the picker', () => {
  const arming = transition(initialState(), { type: 'START' });

  it('says what is being waited for', () => {
    expect(mount(arming).textContent).toContain('Choose what to share');
  });

  it('promises nothing is recorded yet', () => {
    expect(mount(arming).textContent).toMatch(/[Nn]othing is recorded/);
  });

  it('shows no coral, because nothing is being captured', () => {
    // The attribute alone proved nothing: this view reuses the countdown's
    // layout class, and `.sr-countdown .sr-mark-*` painted the registration
    // marks coral while the picker was still open.
    const frame = mount(arming).querySelector('.sr-frame');
    expect(frame.dataset.treatment).toBe('focused');
    expect(mount(arming).querySelector('.sr-arming')).toBeTruthy();
    const css = readFileSync(resolve(__dirname, '../popup/popup.css'), 'utf8');
    expect(css).toMatch(/\.sr-countdown:not\(\.sr-arming\) \.sr-mark-tl/);
    expect(css).not.toMatch(/^\.sr-countdown \.sr-mark-tl/m);
  });

  it('offers the only thing that helps — cancelling', () => {
    expect(mount(arming).querySelector('[data-action="cancel"]')).toBeTruthy();
  });

  it('does not spend a corner strike on waiting', () => {
    // Three strikes in a capture's life, and countdown owns the first.
    expect(mount(arming).querySelector('[data-strike]')).toBeNull();
  });
});

describe('countdown (A6)', () => {
  const cd = [{ type: 'START' }, { type: 'SOURCE_PICKED' }].reduce(transition, initialState());

  it('offers Esc as well as Cancel', () => {
    const root = mount(cd);
    expect(root.textContent).toContain('Esc');
    expect(root.querySelector('[data-action="cancel"]')).toBeTruthy();
  });

  it('strikes the corners on entry', () => {
    expect(mount(cd).querySelector('[data-strike]')).toBeTruthy();
  });

  it('shows the numeral', () => {
    expect(mount(cd).querySelector('.sr-numeral').textContent.trim()).toBe('3');
  });
});

describe('recording (A7) and paused (A8)', () => {
  it('turns the header coral while live', () => {
    expect(mount(recording()).querySelector('.sr-popup-header').dataset.tone).toBe('coral');
  });

  it('announces elapsed time politely, not every second', () => {
    const timer = mount(recording()).querySelector('[data-timer]');
    expect(timer.getAttribute('aria-live')).toBe('polite');
    expect(timer.dataset.announceEvery).toBe('10');
  });

  it('empties the coral fill when paused and holds the duration', () => {
    const rec = recording();
    const paused = transition(rec, { type: 'PAUSE' });
    const root = mount(paused);
    expect(root.querySelector('.sr-popup-header').dataset.tone).toBe('coral-outline');
    expect(root.querySelector('[data-timer]').textContent.trim())
      .toBe(mount(rec).querySelector('[data-timer]').textContent.trim());
  });

  it('separates Discard from the primary pair and names what is lost', () => {
    const paused = transition(recording(), { type: 'PAUSE' });
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

const finished = (extra = []) =>
  [{ type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000, duration: '0:47' } }, ...extra]
    .reduce(transition, initialState());

describe('capture completion (B1–B6)', () => {
  it('B1 offers no Copy link, because there is no link', () => {
    const root = mount(finished());
    expect(root.querySelector('[data-action-key="copyLink"]')).toBeNull();
    expect(root.querySelector('[data-action="primary"]').textContent)
      .toContain('Upload and get link');
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
    const root = mount(finished([
      { type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
    ]));
    expect(root.textContent).toContain('62%');
    expect(root.textContent).toMatch(/4\.3 of 6\.9 MB/);
  });

  it('B2 throttles progress announcements to every 25%', () => {
    const root = mount(finished([{ type: 'UPLOAD' }]));
    expect(root.querySelector('[role="progressbar"]').dataset.announceEvery).toBe('25');
  });

  it('B2 gives every disabled edge action a reason', () => {
    const root = mount(finished([{ type: 'UPLOAD' }]));
    const disabled = root.querySelectorAll('[data-action-key][aria-disabled="true"]');
    expect(disabled.length).toBeGreaterThan(0);
    for (const b of disabled) expect(b.getAttribute('title')).toBeTruthy();
  });

  it('B3 states the file is safe before anything else', () => {
    const body = mount(finished([
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ])).querySelector('[data-failure-body]').textContent;
    expect(body.indexOf('still on this device')).toBeGreaterThan(-1);
    expect(body.indexOf('still on this device')).toBeLessThan(body.indexOf('connection'));
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
      { type: 'UPLOAD' }, { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
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
    const root = mount(finished([
      { type: 'UPLOAD' }, { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 7_200_000 },
      { type: 'SAVED' },
    ]));
    expect(root.querySelectorAll('[data-spine-node][data-state="done"]')).toHaveLength(2);
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
    const root = mount(finished([{ type: 'UPLOAD' }, { type: 'LINK_READY', url: 'https://x' }]));
    expect(root.querySelector('[data-permission="visibility"]')).toBeTruthy();
    expect(root.querySelector('[data-permission="download"]')).toBeTruthy();
  });

  it('B6 strikes the corners once, the third and last time', () => {
    expect(mount(finished([{ type: 'UPLOAD' }, { type: 'LINK_READY', url: 'https://x' }]))
      .querySelector('[data-strike]')).toBeTruthy();
  });
});
