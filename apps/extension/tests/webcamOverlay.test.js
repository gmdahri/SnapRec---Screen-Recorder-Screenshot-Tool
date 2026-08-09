import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p) => readFileSync(resolve(__dirname, p), 'utf8');
const CSS = read('../content/content.css');
const CONTENT = read('../content/content.js');
const BACKGROUND = read('../background/background.js');
const POPUP = read('../popup/popup.js');

/** The camera toggle used to flip its own switch and nothing else — the
 * overlay only ever appeared once a recording had started, so there was no
 * way to check framing or that the camera worked at all beforehand.
 *
 * Verified in Chrome with a fake camera device: toggling on puts a playing
 * 640x480 overlay on the page with one live track and a cyan ring; toggling
 * twice leaves one <video>, not two; starting a take promotes the same
 * element to coral without reopening the camera; and a take with the camera
 * off tears the preview down. These cases hold the wiring that makes that
 * possible, since none of it can run in jsdom. */
describe('the camera toggle shows a live overlay', () => {
  it('makes the popup toggle say so, rather than only recording it', () => {
    expect(POPUP).toMatch(/case 'TOGGLE_INPUT'/);
    expect(POPUP).toMatch(/setWebcamPreview/);
  });

  it('routes it through the background, which owns tabs and injection', () => {
    expect(BACKGROUND).toMatch(/case 'setWebcamPreview'/);
    expect(BACKGROUND).toMatch(/showWebcamPreview.*:.*hideWebcamPreview/s);
  });

  it('handles both messages in the page', () => {
    expect(CONTENT).toMatch(/case 'showWebcamPreview'/);
    expect(CONTENT).toMatch(/case 'hideWebcamPreview'/);
  });

  it('reuses the open camera instead of opening a second one', () => {
    // Two getUserMedia calls means two camera handles and two overlays.
    expect(CONTENT).toMatch(/if \(webcamElement\) \{[^}]*dataset\.preview[^}]*return;/s);
    expect(CONTENT.match(/mediaDevices\.getUserMedia/g)).toHaveLength(1);
  });

  it('guards the await, so a toggle-off mid-prompt does not leave it on', () => {
    expect(CONTENT).toMatch(/webcamWanted/);
    expect(CONTENT).toMatch(/if \(!webcamWanted\)/);
  });

  it('tears the preview down for a take that excludes the camera', () => {
    expect(CONTENT).toMatch(/startWebcam\(\{ preview: false \}\);\s*\} else \{[^}]*stopWebcam\(\)/s);
  });
});

describe('the ring says whether you are live', () => {
  it('is cyan while framing — focus, not capture', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*border:\s*3px solid #06A6C0/s);
  });

  it('is coral once recording, the one thing coral is reserved for', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\[data-preview="false"\]\s*\{\s*border-color:\s*#FF3B2E/s);
  });

  it('mirrors the preview so it can be used for aiming', () => {
    expect(CSS).toMatch(/\.snaprec-webcam\s*\{[^}]*transform:\s*scaleX\(-1\)/s);
  });

  it('keeps the pre-plate palette out of every in-page overlay', () => {
    // Not just the webcam: content.css was the last surface still carrying
    // the old violet, plus a generic red and slate greys from before the
    // plate. The whole file is in scope so it cannot drift back one rule at
    // a time.
    expect(CSS).not.toMatch(/123,\s*37,\s*244|7b25f4|8B5CF6|6366f1/i);
    expect(CSS).not.toMatch(/#(ef4444|dc2626)\b/i);
    expect(CSS).not.toMatch(/#(475569|64748b|130d1c|ece7f4)\b/i);
  });
});


/** Reported from the field: the overlay came up but the switch still read
 * "off". The popup is rebuilt from initialState() every time it opens, and
 * the overlay outlives it, so the two drifted apart the moment the popup
 * closed — leaving a switch that needed two clicks to turn off a camera that
 * was already running.
 *
 * Verified in Chrome with a fake camera: with the overlay up and the page
 * frontmost, re-booting the popup reads the toggle as on, and a single click
 * then takes it to off with zero overlays left. A tab that never had an
 * overlay reads off. */
describe('the toggle matches the tab in front of you', () => {
  it('asks on open instead of assuming the default', () => {
    expect(POPUP).toMatch(/getWebcamPreview/);
    expect(POPUP).toMatch(/inputs:\s*\{\s*\.\.\.state\.inputs,\s*camera:\s*cam\.on\s*\}/);
  });

  it('answers from the page, which is where the overlay actually lives', () => {
    expect(BACKGROUND).toMatch(/message\.action === 'getWebcamPreview'/);
    expect(BACKGROUND).toMatch(/isWebcamPreviewOn/);
    expect(CONTENT).toMatch(/case 'isWebcamPreviewOn'/);
    expect(CONTENT).toMatch(/sendResponse\(\{ on: !!webcamElement \}\)/);
  });

  it('never answers from a stored preference', () => {
    // A stored flag lit the toggle on tabs showing no camera, so the first
    // click read as turning something off. Silence means no content script,
    // which means no overlay — so silence is false.
    expect(BACKGROUND).not.toMatch(/storage\.local\.(get|set)\(.*webcamPreview/);
    expect(BACKGROUND).toMatch(/sendResponse\(\{ on: reply\?\.on === true \}\)/);
    expect(BACKGROUND).toMatch(/catch \{\s*sendResponse\(\{ on: false \}\);/);
  });
});
