import puppeteer from 'puppeteer';
const SCRATCH = '/private/tmp/claude-501/-Users-codincops-Desktop-Projects-screenshoter/9cb070e7-c37f-41ed-b85a-b8b646daddab/scratchpad';
const EXT = '/Users/codincops/Desktop/Projects/screenshoter/apps/extension';
const CHROME = process.env.HOME + '/.cache/puppeteer/chrome/mac_arm-131.0.6778.204/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const wait = ms => new Promise(r => setTimeout(r, ms));

const b = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--use-fake-ui-for-media-stream',       // auto-grant camera
    '--use-fake-device-for-media-stream',   // synthetic camera, no hardware
    '--no-first-run',
  ],
});

// The service worker is the extension's identity.
const target = await b.waitForTarget(t => t.type() === 'service_worker', { timeout: 15000 });
const extId = new URL(target.url()).host;
console.log('extension id:', extId);

const page = await b.newPage();
await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
await wait(1500);

const popup = await b.newPage();
await popup.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
await wait(1500);

const cam = await popup.$('[data-toggle="camera"]');
console.log('camera toggle found:', !!cam);
console.log('camera before:', await popup.$eval('[data-toggle="camera"]', e => e.getAttribute('aria-checked')));

await cam.click();
await wait(3000);
console.log('camera after:', await popup.$eval('[data-toggle="camera"]', e => e.getAttribute('aria-checked')));

// The overlay lives in the PAGE, not the popup.
const probe = async () => page.evaluate(() => {
  const v = document.querySelector('video.snaprec-webcam');
  if (!v) return { present: false };
  const cs = getComputedStyle(v);
  return {
    present: true,
    preview: v.dataset.preview,
    playing: !v.paused && v.readyState >= 2,
    videoW: v.videoWidth, videoH: v.videoHeight,
    border: cs.borderTopColor,
    transform: cs.transform,
    live: !!(v.srcObject && v.srcObject.getVideoTracks().some(t => t.readyState === 'live')),
  };
});
console.log('overlay after toggle ON :', JSON.stringify(await probe()));
await page.screenshot({ path: `${SCRATCH}/cam-on.png` });

// Toggle off again.
await cam.click();
await wait(2000);
console.log('overlay after toggle OFF:', JSON.stringify(await probe()));

await b.close();
