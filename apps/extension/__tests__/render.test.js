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
