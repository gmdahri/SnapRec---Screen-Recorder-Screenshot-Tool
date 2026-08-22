import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { displayConstraints, RESOLUTION_CAPS } from '../offscreen/resolution.core.js';
import { initialState, recordingOptions, transition } from '../popup/state.js';

/** The resolution picker did nothing.
 *
 * Two independent defects on one path, both needed for the control to work:
 *
 *   1. popup.js built the START payload from `state.source` and `state.inputs`
 *      only, so `state.options` — resolution included — never left the popup.
 *   2. offscreen.js hardcoded the getDisplayMedia constraints to
 *      `{ video: { cursor: 'always' } }`, so a delivered resolution had nothing
 *      reading it.
 *
 * The background layer was always transparent: background.js forwards
 * `message.options` to the offscreen document verbatim.
 */

describe('resolution -> getDisplayMedia constraints', () => {
  it('caps width and height for each numeric option', () => {
    expect(displayConstraints('720p').video).toMatchObject({ width: { max: 1280 }, height: { max: 720 } });
    expect(displayConstraints('1080p').video).toMatchObject({ width: { max: 1920 }, height: { max: 1080 } });
    expect(displayConstraints('1440p').video).toMatchObject({ width: { max: 2560 }, height: { max: 1440 } });
    expect(displayConstraints('4K').video).toMatchObject({ width: { max: 3840 }, height: { max: 2160 } });
  });

  it('keeps cursor capture on for every option', () => {
    for (const label of Object.keys(RESOLUTION_CAPS).concat(['Max', undefined])) {
      expect(displayConstraints(label).video.cursor).toBe('always');
    }
  });

  /* "Max" is the default precisely because unconstrained capture is what the
   * extension has always done. Anything else would silently downgrade every
   * existing 1440p/4K user's recordings the moment this fix shipped. */
  it('applies no size cap for Max', () => {
    const { video } = displayConstraints('Max');
    expect(video.width).toBeUndefined();
    expect(video.height).toBeUndefined();
  });

  it('applies no size cap for a missing or unknown value', () => {
    for (const bad of [undefined, null, '', 'potato', '8K', 720]) {
      const { video } = displayConstraints(bad);
      expect(video.width, `for ${JSON.stringify(bad)}`).toBeUndefined();
      expect(video.height, `for ${JSON.stringify(bad)}`).toBeUndefined();
    }
  });

  it('never mutates the shared cap table', () => {
    const before = JSON.stringify(RESOLUTION_CAPS);
    displayConstraints('1080p').video.width.max = 99;
    expect(JSON.stringify(RESOLUTION_CAPS)).toBe(before);
  });

  /* The picker offering a label the cap table does not know is the exact failure
   * this whole fix was about: a control that looks like it does something and
   * silently does not. "Max" is the one intentional exception — it means no cap,
   * so it has no table entry by design. */
  it('every label the picker offers is either Max or in the cap table', () => {
    const render = readFileSync(resolve(__dirname, '../popup/render.js'), 'utf8');
    const offered = JSON.parse(
      /const RESOLUTIONS = (\[[^\]]*\]);/.exec(render)[1].replace(/'/g, '"'),
    );

    expect(offered).toContain('Max');
    const unmapped = offered.filter((l) => l !== 'Max' && !(l in RESOLUTION_CAPS));
    expect(unmapped).toEqual([]);
  });

  it('the default resolution is one the picker actually offers', () => {
    const render = readFileSync(resolve(__dirname, '../popup/render.js'), 'utf8');
    const offered = JSON.parse(
      /const RESOLUTIONS = (\[[^\]]*\]);/.exec(render)[1].replace(/'/g, '"'),
    );
    expect(offered).toContain(initialState().options.resolution);
  });

  it('the classic-script copy has not drifted from the tested module', () => {
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecResolution[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../offscreen/resolution.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../offscreen/resolution.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});

describe('START payload carries the capture options', () => {
  it('includes the picked resolution', () => {
    const state = transition(
      { ...initialState(), options: { ...initialState().options, resolution: '1440p' } },
      { type: 'NOOP' },
    );
    expect(recordingOptions(state).resolution).toBe('1440p');
  });

  it('still carries source and every input flag', () => {
    const state = initialState();
    expect(recordingOptions(state)).toMatchObject({
      source: state.source,
      microphone: state.inputs.mic,
      systemAudio: state.inputs.tabAudio,
      webcam: state.inputs.camera,
    });
  });

  it('carries the default resolution when the user never opens the picker', () => {
    expect(recordingOptions(initialState()).resolution).toBe('Max');
  });

  /* The picker writes through SET_OPTION, so a round trip proves the whole
   * popup-side chain rather than just the payload builder. */
  it('reflects a picker change made through SET_OPTION', () => {
    const picked = transition(initialState(), { type: 'SET_OPTION', key: 'resolution', value: '720p' });
    expect(recordingOptions(picked).resolution).toBe('720p');
  });
});
