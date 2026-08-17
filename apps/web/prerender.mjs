import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
/* SEO W5: the 48 routes — including all 35 blog slugs — used to be a literal array
 * here, duplicated in sitemap.xml and indexnow.yml. They now come from routes.mjs,
 * which reads the post list out of src/data/blogData.ts. Adding a post is one edit. */
import { getAllRoutes } from './routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');

const ROUTES = getAllRoutes().map(r => r.route);

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
        const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff' };
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

  /* `channel: 'chrome'` drives the locally installed Chrome rather than a
   * puppeteer-managed download, which fails with "Could not find Chrome" when
   * the cache holds an older build than puppeteer expects. Same workaround as
   * packages/design-system/scripts/render-icons.mjs. Falls back to the managed
   * browser, which is what CI uses. */
  const launchOptions = { headless: true, args: ['--no-sandbox'] };
  const browser = await puppeteer
    .launch({ ...launchOptions, channel: 'chrome' })
    .catch(() => puppeteer.launch(launchOptions));

  let rendered = 0;
  const failed = [];

  for (const route of ROUTES) {
    const page = await browser.newPage();
    const url = `http://localhost:${PORT}${route}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for React to hydrate and render
      await new Promise((r) => setTimeout(r, 2500));

      const html = await page.content();

      /* SEO C2/W2: a prerender that silently produced the 404 page would ship a
       * noindex marketing page. Catch it here rather than in Search Console. */
      if (html.includes('name="robots" content="noindex')) {
        throw new Error('rendered as noindex — the catch-all route matched');
      }

      // Write to dist/<route>/index.html
      const outDir = resolve(DIST, '.' + route);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html);
      rendered++;
      console.log(`[prerender] ${rendered}/${ROUTES.length} ${route}`);
    } catch (err) {
      failed.push({ route, message: err.message });
      console.error(`[prerender] FAILED ${route}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();
  console.log(`[prerender] Done. ${rendered}/${ROUTES.length} routes prerendered.\n`);

  /* SEO W2: a partial prerender is the failure mode that hides best — the build
   * goes green and the missing routes just serve the generic shell. Fail loudly. */
  if (failed.length > 0) {
    console.error(`[prerender] ${failed.length} route(s) did not render:`);
    for (const f of failed) console.error(`  ${f.route} — ${f.message}`);
    process.exit(1);
  }
}

/* SEO W5: only auto-run as a CLI entry point, so routes.mjs consumers and any
 * future importer can pull ROUTES from here without launching a browser. */
const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  prerender().catch((err) => {
    console.error('[prerender] Fatal error:', err);
    process.exit(1);
  });
}

export { ROUTES, prerender };
