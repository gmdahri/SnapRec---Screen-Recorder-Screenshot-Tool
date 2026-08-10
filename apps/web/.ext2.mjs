import puppeteer from 'puppeteer';
const SCRATCH = '/private/tmp/claude-501/-Users-codincops-Desktop-Projects-screenshoter/9cb070e7-c37f-41ed-b85a-b8b646daddab/scratchpad';
const EXT = '/Users/codincops/Desktop/Projects/screenshoter/apps/extension';
const CHROME = process.env.HOME + '/.cache/puppeteer/chrome/mac_arm-131.0.6778.204/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const wait = ms => new Promise(r => setTimeout(r, ms));

const b = await puppeteer.launch({
  executablePath: CHROME, headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
         '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-first-run'],
});
const target = await b.waitForTarget(t => t.type() === 'service_worker', { timeout: 15000 });
const sw = await target.worker();
const extId = new URL(target.url()).host;

const page = await b.newPage();
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await wait(1200);

const probe = () => page.evaluate(() => {
  const v = document.querySelector('video.snaprec-webcam');
  if (!v) return { present: false };
  const cs = getComputedStyle(v);
  return { present: true, preview: v.dataset.preview,
    playing: !v.paused && v.readyState >= 2, dims: `${v.videoWidth}x${v.videoHeight}`,
    border: cs.borderTopColor, mirrored: cs.transform,
    liveTracks: v.srcObject ? v.srcObject.getVideoTracks().filter(t => t.readyState === 'live').length : 0 };
});

console.log('before          :', JSON.stringify(await probe()));

// Send from the popup's own context — the real path, through the background's
// message switch. evaluate() needs no focus, so example.com stays the active
// tab, which is what getActiveTab resolves to for a real toolbar popup.
const popup = await b.newPage();
await popup.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
await wait(1200);
await page.bringToFront();
await wait(400);
const say = (enabled) => popup.evaluate(
  (enabled) => chrome.runtime.sendMessage({ action: 'setWebcamPreview', enabled }), enabled);
await say(true);
await wait(3500);
console.log('toggle ON       :', JSON.stringify(await probe()));
console.log('stored          :', JSON.stringify(await sw.evaluate(() => chrome.storage.local.get('webcamPreview'))));
await page.screenshot({ path: `${SCRATCH}/cam-on.png` });

// Double-toggle must not open a second camera.
await say(true);
await wait(1500);
console.log('count of videos :', await page.$$eval('video.snaprec-webcam', v => v.length));

await say(false);
await wait(1500);
console.log('toggle OFF      :', JSON.stringify(await probe()));

// --- the handoff into recording ---
await say(true);
await wait(2500);
const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
await sw.evaluate((id) => chrome.tabs.sendMessage(id, {
  action: 'showRecordingOverlay', startTime: Date.now(), webcam: true }), tabId);
await wait(1800);
console.log('recording w/ cam:', JSON.stringify(await probe()), 'videos:', await page.$$eval('video.snaprec-webcam', v => v.length));

await sw.evaluate((id) => chrome.tabs.sendMessage(id, { action: 'hideRecordingOverlay' }), tabId);
await wait(1200);

// A take without the camera must not leave the preview running over it.
await say(true);
await wait(2500);
await sw.evaluate((id) => chrome.tabs.sendMessage(id, {
  action: 'showRecordingOverlay', startTime: Date.now(), webcam: false }), tabId);
await wait(1500);
console.log('recording no cam:', JSON.stringify(await probe()));
await sw.evaluate((id) => chrome.tabs.sendMessage(id, { action: 'hideRecordingOverlay' }), tabId);
await wait(1000);

// And the popup's toggle really does emit it.
await popup.bringToFront();
await wait(400);
const sent = [];
await popup.exposeFunction('__record', (m) => sent.push(m));
await popup.evaluate(() => {
  const real = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = (msg, cb) => { window.__record(JSON.stringify(msg)); return real(msg, cb); };
});
await popup.click('[data-toggle="camera"]');
await wait(1200);
console.log('popup sent      :', sent.filter(m => m.includes('ebcam')).join(' | ') || '(nothing)');

await b.close();
