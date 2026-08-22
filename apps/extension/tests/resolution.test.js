import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { displayConstraints, RESOLUTION_CAPS } from '../offscreen/resolution.core.js';
import { initialState, recordingOptions, transition } from '../popup/state.js';

/** The resolution picker did nothing.
 *
 * Three independent defects on one path, all needed for the control to work:
 *
 *   1. popup.js built the START payload from `state.source` and `state.inputs`
 *      only, so `state.options` — resolution included — never left the popup.
 *   2. offscreen.js hardcoded the getDisplayMedia constraints to
 *      `{ video: { cursor: 'always' } }`, so a delivered value had no consumer.
 *   3. boot() never read the option back from storage, so even once it worked
 *      the choice reset to the default every time the popup was reopened.
 *
 * The background layer was always transparent: it forwards message.options to
 * the offscreen document verbatim.
 */

describe('resolution -> getDisplayMedia constraints', () => {
    it('caps width and height for each numeric option', () => {
        expect(displayConstraints('720p').video).toMatchObject({ width: { max: 1280 }, height: { max: 720 } });
        expect(displayConstraints('1080p').video).toMatchObject({ width: { max: 1920 }, height: { max: 1080 } });
        expect(displayConstraints('1440p').video).toMatchObject({ width: { max: 2560 }, height: { max: 1440 } });
        expect(displayConstraints('4K').video).toMatchObject({ width: { max: 3840 }, height: { max: 2160 } });
    });

    it('keeps cursor capture on for every option', () => {
        for (const label of [...Object.keys(RESOLUTION_CAPS), 'Max', undefined]) {
            expect(displayConstraints(label).video.cursor).toBe('always');
        }
    });

    /* "Max" is the default precisely because unconstrained capture is what the
     * extension has always done. Honouring the old stored '1080p' would have
     * silently downgraded every existing 1440p and 4K user the day this shipped. */
    it('applies no size cap for Max', () => {
        const { video } = displayConstraints('Max');
        expect(video.width).toBeUndefined();
        expect(video.height).toBeUndefined();
    });

    it('applies no size cap for a missing or unknown value', () => {
        for (const bad of [undefined, null, '', 'potato', '8K', 720]) {
            const { video } = displayConstraints(bad);
            expect(video.width, `for ${JSON.stringify(bad)}`).toBeUndefined();
        }
    });

    it('never mutates the shared cap table', () => {
        const before = JSON.stringify(RESOLUTION_CAPS);
        displayConstraints('1080p').video.width.max = 99;
        expect(JSON.stringify(RESOLUTION_CAPS)).toBe(before);
    });

    it('every label the picker offers is either Max or in the cap table', () => {
        const render = readFileSync(resolve(__dirname, '../popup/render.js'), 'utf8');
        const offered = JSON.parse(
            /const RESOLUTIONS = (\[[^\]]*\]);/.exec(render)[1].replace(/'/g, '"'));
        expect(offered).toContain('Max');
        expect(offered.filter((l) => l !== 'Max' && !(l in RESOLUTION_CAPS))).toEqual([]);
    });

    it('the classic-script copy has not drifted from the tested module', () => {
        const normalise = (s) => s
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
            .replace(/globalThis\.SnapRecResolution[\s\S]*$/, '')
            .replace(/export\s*\{[^}]*\};?/g, '').replace(/^\s*export\s+/gm, '')
            .replace(/\s+/g, ' ').trim();
        const core = readFileSync(resolve(__dirname, '../offscreen/resolution.core.js'), 'utf8');
        const classic = readFileSync(resolve(__dirname, '../offscreen/resolution.js'), 'utf8');
        expect(normalise(classic)).toBe(normalise(core));
    });
});

/* Requirement: the selected value reaches the recording. */
describe('the selected resolution reaches the recorder', () => {
    it('is included in the START payload', () => {
        const picked = transition(initialState(), { type: 'SET_OPTION', key: 'resolution', value: '1440p' });
        expect(recordingOptions(picked).resolution).toBe('1440p');
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

    it('popup.js sends the built payload rather than an inline literal', () => {
        const src = readFileSync(resolve(__dirname, '../popup/popup.js'), 'utf8');
        expect(src).toContain('recordingOptions(state)');
    });

    /* End to end: picker label -> payload -> constraints the browser receives. */
    it('turns a picked label into the constraints getDisplayMedia is given', () => {
        for (const [label, expected] of [
            ['720p', { max: 1280 }], ['1080p', { max: 1920 }],
            ['1440p', { max: 2560 }], ['4K', { max: 3840 }],
        ]) {
            const picked = transition(initialState(), { type: 'SET_OPTION', key: 'resolution', value: label });
            const payload = recordingOptions(picked);
            expect(displayConstraints(payload.resolution).video.width, label).toEqual(expected);
        }
    });

    it('a payload with no resolution records uncapped rather than failing', () => {
        const legacy = { source: 'tab', microphone: true, systemAudio: true, webcam: false };
        expect(displayConstraints(legacy.resolution).video.width).toBeUndefined();
    });
});

/* Requirement: the selection survives closing and reopening the popup. */
describe('resolution persists across popup close and reopen', () => {
    let store;

    beforeEach(() => {
        store = {};
        globalThis.chrome = {
            runtime: { lastError: undefined },
            storage: { local: {
                get: async (k) => {
                    const keys = typeof k === 'string' ? [k] : Array.isArray(k) ? k : Object.keys(k);
                    const out = {};
                    for (const key of keys) if (key in store) out[key] = store[key];
                    return out;
                },
                set: async (obj) => { Object.assign(store, obj); },
            } },
        };
    });

    it('defaults to Max when nothing has ever been chosen', async () => {
        const { loadResolution } = await import('../popup/capturePrefs.js');
        await expect(loadResolution()).resolves.toBe('Max');
        expect(initialState().options.resolution).toBe('Max');
    });

    it('reads back exactly what was saved — the close/reopen round trip', async () => {
        const { loadResolution, saveResolution } = await import('../popup/capturePrefs.js');
        await saveResolution('720p');
        await expect(loadResolution()).resolves.toBe('720p');
    });

    it('survives a simulated reopen: save, drop popup state, reload', async () => {
        const { loadResolution, saveResolution } = await import('../popup/capturePrefs.js');
        // First session: user picks 1440p.
        await saveResolution('1440p');
        // Popup closes — all popup state is discarded, storage is not.
        // Second session: boot() seeds from storage.
        const seeded = { ...initialState(), options: { ...initialState().options, resolution: await loadResolution() } };
        expect(seeded.options.resolution).toBe('1440p');
        expect(recordingOptions(seeded).resolution).toBe('1440p');
    });

    it('ignores a stored value the picker no longer offers', async () => {
        const { loadResolution } = await import('../popup/capturePrefs.js');
        store.captureResolution = '8K';
        await expect(loadResolution()).resolves.toBe('Max');
    });

    it('falls back to the default when storage throws', async () => {
        globalThis.chrome.storage.local.get = async () => { throw new Error('unavailable'); };
        const { loadResolution } = await import('../popup/capturePrefs.js');
        await expect(loadResolution()).resolves.toBe('Max');
    });

    it('saving never throws when storage is unavailable', async () => {
        globalThis.chrome.storage.local.set = async () => { throw new Error('unavailable'); };
        const { saveResolution } = await import('../popup/capturePrefs.js');
        await expect(saveResolution('720p')).resolves.toBeUndefined();
    });

    it('popup.js seeds from storage on boot and writes on change', () => {
        const src = readFileSync(resolve(__dirname, '../popup/popup.js'), 'utf8');
        expect(src).toContain('loadResolution');
        expect(src).toContain('saveResolution');
    });
});
