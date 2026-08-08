import { describe, expect, it } from 'vitest';
import { derive, initialState, transition } from '../popup/state.js';

const run = (events, from = initialState()) => events.reduce(transition, from);

const recording = () =>
  run([{ type: 'START' }, { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' }]);

describe('popup state machine', () => {
  it('starts ready to record with six controls and nothing else', () => {
    const s = initialState();
    expect(s.view).toBe('ready');
    expect(s.mode).toBe('record');
    expect(s.source).toBe('tab');
    expect(s.inputs).toEqual({ mic: true, tabAudio: true, camera: false });
  });

  it('drops audio inputs entirely in screenshot mode — not disabled, gone', () => {
    const s = transition(initialState(), { type: 'SET_MODE', mode: 'screenshot' });
    expect(s.view).toBe('screenshot');
    expect(derive(s).showsAudioInputs).toBe(false);
  });

  it('does not make the screenshot action coral — a screenshot is instantaneous', () => {
    const s = transition(initialState(), { type: 'SET_MODE', mode: 'screenshot' });
    expect(derive(s).primaryTone).toBe('carbon');
    expect(derive(initialState()).primaryTone).toBe('coral');
  });

  it('runs countdown → recording and writes nothing until recording starts', () => {
    let s = transition(initialState(), { type: 'START' });
    expect(s.view).toBe('countdown');
    expect(s.count).toBe(3);
    expect(derive(s).hasWrittenBytes).toBe(false);

    s = run([{ type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' }], s);
    expect(s.view).toBe('recording');
    expect(derive(s).hasWrittenBytes).toBe(true);
  });

  it('cancelling the countdown returns to ready and writes nothing', () => {
    const s = run([{ type: 'START' }, { type: 'TICK' }, { type: 'CANCEL' }]);
    expect(s.view).toBe('ready');
    expect(s.elapsed).toBe(0);
  });

  it('paused holds the duration and drops coral to outline', () => {
    let s = run([{ type: 'TICK' }, { type: 'TICK' }], recording());
    const elapsed = s.elapsed;
    expect(elapsed).toBe(2);

    s = transition(s, { type: 'PAUSE' });
    expect(s.view).toBe('paused');
    expect(s.elapsed).toBe(elapsed);
    expect(derive(s).coralTreatment).toBe('outline');
    expect(derive(transition(s, { type: 'RESUME' })).coralTreatment).toBe('filled');
  });

  it('does not advance the timer while paused', () => {
    const s = run([{ type: 'PAUSE' }, { type: 'TICK' }, { type: 'TICK' }], recording());
    expect(s.elapsed).toBe(0);
  });

  it('offers no Copy link before a link exists', () => {
    const s = run([{ type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } }]);
    expect(s.view).toBe('complete');
    expect(derive(s).actions.map((a) => a.key)).not.toContain('copyLink');
    expect(derive(s).primaryLabel).toBe('Upload and get link');
  });

  it('exposes Copy link only once the link resolves', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 7_200_000 },
      { type: 'LINK_READY', url: 'https://snaprecorder.org/v/abc' },
    ]);
    expect(s.view).toBe('linkReady');
    expect(derive(s).actions.map((a) => a.key)).toContain('copyLink');
  });

  it('treats offline as queued, never as failure', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'OFFLINE' },
    ]);
    expect(s.view).toBe('offline');
    expect(derive(s).spineState).toBe('offline');
    expect(derive(s).usesCoral).toBe(false);
  });

  it('marks a failed upload with a break at the stopping point', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]);
    expect(s.view).toBe('uploadFailed');
    expect(derive(s).spineState).toBe('failed');
    expect(derive(s).breakAt).toBe(62);
    expect(derive(s).statusWord).toBe('stopped');
  });

  it('resumes a failed upload from where it stopped, not from zero', () => {
    let s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 62, bytes: 4_464_000 },
      { type: 'UPLOAD_FAILED', reason: 'network', at: 62 },
    ]);
    s = transition(s, { type: 'UPLOAD' });
    expect(s.view).toBe('uploading');
    expect(s.upload.pct).toBe(62);
  });

  it('cancelling an upload returns the file untouched to the local state', () => {
    const s = run([
      { type: 'FINISHED', capture: { id: 'c1', bytes: 7_200_000 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 40, bytes: 2_880_000 },
      { type: 'CANCEL' },
    ]);
    expect(s.view).toBe('complete');
    expect(s.capture.id).toBe('c1');
  });

  it('keeps the recording path open when a permission is required', () => {
    const s = run([{ type: 'PERMISSION_REQUIRED', input: 'mic' }]);
    expect(s.view).toBe('permission');
    expect(derive(s).canProceedWithout).toBe(true);
  });

  it('uses cyan for permission-required and coral only once denied', () => {
    const required = run([{ type: 'PERMISSION_REQUIRED', input: 'mic' }]);
    expect(derive(required).usesCoral).toBe(false);

    const denied = transition(required, { type: 'PERMISSION_DENIED', input: 'mic' });
    expect(denied.view).toBe('denied');
    expect(derive(denied).usesCoral).toBe(true);
    expect(derive(denied).statusWord).toBe('blocked');
  });

  it('returns to where it was once permission is granted', () => {
    const s = run([
      { type: 'PERMISSION_REQUIRED', input: 'mic' },
      { type: 'PERMISSION_GRANTED', input: 'mic' },
    ]);
    expect(s.view).toBe('ready');
    expect(s.pendingPermission).toBeNull();
  });

  it('fires the corner strike exactly three times in a capture life', () => {
    const seen = [];
    let s = initialState();
    for (const e of [
      { type: 'START' },
      { type: 'TICK' }, { type: 'TICK' }, { type: 'TICK' },
      { type: 'STOP' },
      { type: 'FINISHED', capture: { id: 'c1', bytes: 1 } },
      { type: 'UPLOAD' },
      { type: 'UPLOAD_PROGRESS', pct: 100, bytes: 1 },
      { type: 'LINK_READY', url: 'https://x' },
    ]) {
      s = transition(s, e);
      if (derive(s).strikesCorners) seen.push(s.view);
    }
    expect(seen).toEqual(['countdown', 'complete', 'linkReady']);
  });

  it('never shows a percentage while finishing — indeterminate stays honest', () => {
    const s = transition(initialState(), { type: 'STOP' });
    expect(derive(s).indeterminate).toBe(true);
  });

  it('ignores events that make no sense in the current view', () => {
    const s = initialState();
    expect(transition(s, { type: 'PAUSE' })).toBe(s);
    expect(transition(s, { type: 'RESUME' })).toBe(s);
    expect(transition(s, { type: 'TICK' })).toBe(s);
  });
});
