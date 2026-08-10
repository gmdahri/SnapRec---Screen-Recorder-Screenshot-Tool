import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../../apps/extension/icons');
const SIZES = [16, 32, 48, 128];

/** Carbon tile, cyan brackets, coral capture dot — the mark from primitives/Logo.tsx. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">
  <rect width="14" height="14" fill="#0C1011"/>
  <path d="M2 7V2h5" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <path d="M12 7v5H7" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <rect x="5.5" y="5.5" width="3" height="3" fill="#FF3B2E"/>
</svg>`;

/* `channel: 'chrome'` drives the locally installed Chrome rather than a
 * puppeteer-managed download. The cached browser (131) is far older than
 * puppeteer 24.x expects, so the default launch fails with
 * "Could not find Chrome". Falls back to the managed browser if no system
 * Chrome is present. */
async function launch() {
  try {
    return await puppeteer.launch({ channel: 'chrome' });
  } catch {
    return await puppeteer.launch();
  }
}

const browser = await launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0">
       <div style="width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>
     </body></html>`
  );
  const buf = await page.screenshot({ omitBackground: false, type: 'png' });
  writeFileSync(resolve(OUT, `icon${size}.png`), buf);
  console.log(`wrote icon${size}.png`);
}

await browser.close();
