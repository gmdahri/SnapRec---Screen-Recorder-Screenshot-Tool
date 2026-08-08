import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { overlayState, shapeFor, statusLabel } from '../content/webcam.core.js';

describe('webcam overlay (P2)', () => {
  it('shows no handles until the overlay is clicked', () => {
    expect(overlayState({ selected: false }).showHandles).toBe(false);
    expect(overlayState({ selected: true }).showHandles).toBe(true);
  });

  it('names a muted mic in words rather than only removing the ring', () => {
    expect(statusLabel({ micMuted: true })).toBe('Microphone muted');
    expect(overlayState({ micMuted: true }).showLevelRing).toBe(false);
  });

  it('says nothing when everything is working', () => {
    expect(statusLabel({})).toBeNull();
  });

  it('keeps recording when the camera is taken by another app', () => {
    expect(overlayState({ cameraLost: true }).stopsRecording).toBe(false);
    expect(statusLabel({ cameraLost: true })).toBe('Camera in use by another app');
  });

  it('collapses to a labelled pill when the camera is unavailable', () => {
    expect(overlayState({ cameraLost: true }).shape).toBe('pill');
  });

  it('offers a rounded rectangle and a circle, nothing else', () => {
    expect(shapeFor('rect')).toEqual({ borderRadius: 6 });
    expect(shapeFor('circle')).toEqual({ borderRadius: '50%' });
    expect(() => shapeFor('hexagon')).toThrow(/unknown webcam shape/);
  });

  it('the classic-script copy has not drifted from the tested module', () => {
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecWebcam[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../content/webcam.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../content/webcam.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
