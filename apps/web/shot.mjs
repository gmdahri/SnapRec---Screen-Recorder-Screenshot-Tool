import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] })
  .catch(() => puppeteer.launch({ headless: true, args: ['--no-sandbox'] }));
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
await page.goto('http://localhost:5173/privacy', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /accept/i.test(x.textContent || ''));
  b?.click();
});
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: '/tmp/privacy.png' });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
