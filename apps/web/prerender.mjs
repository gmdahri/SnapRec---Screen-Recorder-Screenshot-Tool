import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');

const ROUTES = [
  '/',
  '/how-it-works',
  '/changelog',
  '/privacy',
  '/about',
  '/terms',
  '/contact',
  '/blog',
  '/blog/how-to-record-screen-chrome-free',
  '/blog/best-free-screen-recorders-no-watermark',
  '/blog/how-to-take-full-page-screenshot-chrome',
  '/blog/snaprec-vs-loom-free-alternative',
  '/blog/record-screen-with-audio-webcam-chrome',
  '/blog/how-to-screenshot-on-chromebook',
  '/blog/screen-record-google-meet-free',
  '/blog/best-screenshot-chrome-extensions-2026',
  '/blog/how-to-blur-sensitive-info-screenshot',
  '/blog/screen-recording-tips-remote-work',
  '/blog/how-to-annotate-screenshots-chrome',
  '/blog/screencastify-vs-snaprec-free-alternative',
  '/blog/how-to-record-presentation-with-webcam',
  '/blog/how-to-capture-scrolling-screenshot',
  '/blog/obs-vs-browser-screen-recorder',
  '/blog/screen-recorder-for-teachers-free',
  '/blog/how-to-record-google-slides-presentation',
  '/blog/screen-record-chrome-without-installing',
  '/blog/best-free-loom-alternatives-2026',
  '/blog/how-to-record-zoom-meeting-free',
  '/blog/screen-recording-for-online-classes',
  '/blog/how-to-create-video-bug-report',
  '/blog/how-to-record-microsoft-teams-meeting-free',
  '/blog/screenshot-vs-screen-recording-when-to-use',
  '/blog/how-to-record-product-demo-sales',
];

function startServer(port) {
  const fallback = readFileSync(resolve(DIST, 'index.html'));

  return new Promise((res) => {
    const server = createServer((req, resp) => {
      const url = (req.url.split('?')[0] || '/').replace(/^\/+/, '') || 'index.html';
      const filePath = resolve(DIST, url);

      let content;
      let contentType = 'text/html';

      try {
        content = readFileSync(filePath);
        const ext = filePath.split('.').pop();
        const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff' };
        contentType = types[ext] || 'application/octet-stream';
      } catch {
        // SPA fallback: serve index.html for any path that doesn't match a file
        content = fallback;
        contentType = 'text/html';
      }

      resp.writeHead(200, { 'Content-Type': contentType });
      resp.end(content);
    });

    server.listen(port, () => res(server));
  });
}

async function prerender() {
  const PORT = 4173;
  console.log(`\n[prerender] Starting static server on port ${PORT}...`);
  const server = await startServer(PORT);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  let rendered = 0;
  for (const route of ROUTES) {
    const page = await browser.newPage();
    const url = `http://localhost:${PORT}${route}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for React to hydrate and render
      await new Promise((r) => setTimeout(r, 2500));

      const html = await page.content();

      // Write to dist/<route>/index.html
      const outDir = resolve(DIST, '.' + route);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html);
      rendered++;
      console.log(`[prerender] ${rendered}/${ROUTES.length} ${route}`);
    } catch (err) {
      console.error(`[prerender] FAILED ${route}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();
  console.log(`[prerender] Done. ${rendered}/${ROUTES.length} routes prerendered.\n`);
}

prerender().catch((err) => {
  console.error('[prerender] Fatal error:', err);
  process.exit(1);
});
