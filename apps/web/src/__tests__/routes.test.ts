import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { getPostBySlug } from '../data/blogData';
/* SEO W5/W6: the route list moved out of prerender.mjs into routes.mjs, and both
 * the sitemap and the IndexNow workflow are now generated from it. These tests
 * follow it there, and gain the blog-post coverage they never had. */
// @ts-expect-error — plain .mjs with no type declarations, by design (see routes.mjs)
import { getAllRoutes, getBlogPosts, toAbsoluteUrl } from '../../routes.mjs';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

/** Authenticated and auth-adjacent routes are deliberately excluded: they must
 * not be prerendered, sitemapped or submitted to IndexNow. Adding a route here
 * is a decision — the default is that a new route is public and must appear in
 * all four files. */
const NON_PUBLIC = new Set([
  '/login', '/auth/callback',
  '/home', '/library', '/projects', '/shared', '/analytics', '/settings',
  '/dashboard', '/editor', '/video-editor', '/video-preview',
  // Auth-adjacent: reachable only mid-sign-in, and indexing them would put
  // a half-finished auth flow in search results.
  '/claim', '/session-expired',
  // Opened by the browser on uninstall. Not public in the sitemap sense: it has
  // no inbound links, no search intent, and indexing "we're sorry to see you go"
  // against the brand would be actively harmful.
  '/uninstall-survey',
]);

const app = read('src/App.tsx');

const publicRoutes = [...app.matchAll(/path="(\/[a-z0-9\-/]*)"/g)]
  .map(m => m[1])
  .filter(p => p !== '/' && !NON_PUBLIC.has(p) && ![...NON_PUBLIC].some(n => p.startsWith(`${n}/`)));

describe('public route registration', () => {
  it('found some public routes to check', () => {
    expect(publicRoutes.length).toBeGreaterThan(0);
  });

  it('lists every public route in routes.mjs', () => {
    const routes = read('routes.mjs');
    expect(publicRoutes.filter(p => !routes.includes(`'${p}'`) && !routes.includes(`"${p}"`)))
      .toEqual([]);
  });

  it('lists every public route in sitemap.xml', () => {
    const sitemap = read('public/sitemap.xml');
    expect(publicRoutes.filter(p => !sitemap.includes(p))).toEqual([]);
  });
});

/* SEO C2: the catch-all is what turns an unknown URL into a real 404 instead of
 * a blank 200. It has to be last, or it swallows the routes below it. */
describe('the 404 catch-all', () => {
  it('is registered', () => {
    expect(app).toContain('path="*"');
  });

  it('is the last route', () => {
    const paths = [...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]);
    expect(paths.at(-1)).toBe('*');
  });
});

/* SEO W5/W6: the gap that let IndexNow drift to 10 of 35 posts. The old regex
 * could not match `/blog/:slug`, so individual posts were never checked. */
describe('blog post registration', () => {
  const posts = getBlogPosts() as { slug: string; lastmod: string }[];

  it('parsed the posts out of blogData.ts', () => {
    expect(posts.length).toBeGreaterThan(30);
  });

  it('lists every post in sitemap.xml, with its own lastmod', () => {
    const sitemap = read('public/sitemap.xml');
    const missing = posts.filter(p => !sitemap.includes(`/blog/${p.slug}/`));
    expect(missing.map(p => p.slug)).toEqual([]);

    const staleLastmod = posts.filter(p =>
      !sitemap.includes(`<loc>${toAbsoluteUrl(`/blog/${p.slug}`)}</loc>\n    <lastmod>${p.lastmod}</lastmod>`));
    expect(staleLastmod.map(p => p.slug)).toEqual([]);
  });

  it('has one sitemap entry per route, and no extras', () => {
    const sitemap = read('public/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const expected = (getAllRoutes() as { route: string }[]).map(r => toAbsoluteUrl(r.route));

    expect(locs).toEqual(expected);
  });
});

/* SEO W6: the workflow used to carry a hand-written urlList. If someone
 * reintroduces one, this fails — the point is that it reads the sitemap. */
describe('IndexNow submission', () => {
  const workflow = readFileSync(
    resolve(__dirname, '../../../../.github/workflows/indexnow.yml'), 'utf8');

  it('derives its URL list from sitemap.xml', () => {
    expect(workflow).toContain('sitemap.xml');
  });

  it('does not hardcode a urlList', () => {
    expect(workflow).not.toMatch(/"urlList":\s*\[\s*"https/);
  });
});

/* SEO: trailing-slash canonicalisation.
 *
 * GSC was reporting 15 posts as "Crawled - currently not indexed" and four
 * marketing pages as "Page with redirect". The server was never the problem:
 * public/_redirects 301s the bare form to the slashed one, routes.mjs
 * toAbsoluteUrl() writes the slashed form into the sitemap, and SEO.tsx emits a
 * slashed canonical. Every internal link, however, pointed at the bare form —
 * including the sitewide navbar and footer, so every page on the site sent
 * Googlebot through a redirect and offered it a URL the canonical disowned.
 *
 * These two cases are the guard: the format stays consistent, and both forms
 * still resolve for the inbound links already out there. */
describe('internal links use the canonical trailing-slash form', () => {
  /* Public, indexable routes only. The signed-in app, /login and /v/ share links
   * are served bare with a 200 and have no trailing-slash redirect, so adding a
   * slash to those would 404 them. They are noindex anyway. */
  const publicPaths = [
    ...(read('routes.mjs').match(/route: '(\/[a-z0-9/-]*)'/g) || [])
      .map(m => m.replace(/route: '|'/g, ''))
      .filter(p => p !== '/'),
    ...(getBlogPosts() as { slug: string }[]).map(p => `/blog/${p.slug}`),
  ];

  const sources = globSync('src/**/*.{ts,tsx}').map(f => ({ file: f, text: read(f) }));

  it('found the sources and the routes to check', () => {
    expect(publicPaths.length).toBeGreaterThan(40);
    expect(sources.length).toBeGreaterThan(20);
  });

  it('has no bare link to a public route left anywhere in src', () => {
    /* `to=`/`href=`/`to:` only — a bare path inside a route definition, a
     * canonical `url=` prop or a JSON-LD string is not a link a crawler
     * follows, and App.tsx must keep its slashless route patterns. */
    const offenders = sources.flatMap(({ file, text }) =>
      publicPaths
        .filter(p => new RegExp(`(to|href)(=|: )["'\`]${p}["'\`]`).test(text))
        .map(p => `${file} -> ${p}`));

    expect(offenders).toEqual([]);
  });

  it('builds blog links from the slug with the slash included', () => {
    /* The template-literal form the cards and related-posts lists use. Missing
     * the slash here is what put both forms of 39 post URLs in front of
     * Googlebot at once. */
    const bare = sources.filter(({ text }) =>
      /(to|href)=\{`\/blog\/\$\{[A-Za-z_.]+\.slug\}`/.test(text));
    expect(bare.map(s => s.file)).toEqual([]);
  });
});

describe('both URL forms still resolve to the same post', () => {
  /* The risk of the change above: if React Router did not normalise the
   * trailing slash, `/blog/<slug>/` would hand BlogPost a slug of
   * "<slug>/" — no post would match and every internal blog link on the site
   * would bounce to /blog/. It does normalise; this is what says so. */
  const slug = (getBlogPosts() as { slug: string }[])[0].slug;

  it('matches the canonical trailing-slash URL, with a clean slug param', () => {
    expect(matchPath('/blog/:slug', `/blog/${slug}/`)?.params.slug).toBe(slug);
  });

  it('still matches the bare URL, for inbound links already in the wild', () => {
    expect(matchPath('/blog/:slug', `/blog/${slug}`)?.params.slug).toBe(slug);
  });

  it('resolves the post either way', () => {
    for (const path of [`/blog/${slug}/`, `/blog/${slug}`]) {
      const matched = matchPath('/blog/:slug', path)!.params.slug!;
      expect(getPostBySlug(matched)?.slug).toBe(slug);
    }
  });
});

/* SEO / routing: the redirect table has to keep pace with the route list.
 *
 * Cloudflare Pages does not honour per-route 200 rewrites to /index.html for
 * paths with no file on disk, and it downgrades a 404 status here to 200. The
 * only arrangement that works is 301s for normalisation, prerendered files on
 * disk, and one `/*` catch-all last — see the header comment in _redirects.
 *
 * This suite guards the two halves that are easy to get wrong: a public route
 * added to routes.mjs without its 301, and the catch-all losing its last-line
 * position (which silently disables every 301 below it). */
describe('_redirects', () => {
  const redirects = read('public/_redirects');
  const routes: string[] = (read('routes.mjs').match(/route: '(\/[a-z0-9/-]*)'/g) || [])
    .map(m => m.replace(/route: '|'/g, ''))
    .filter(p => p !== '/');

  /** Rule lines only — the file is mostly explanatory comments. */
  const rules = redirects.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  it('301s the bare form of every public route to the trailing-slash form', () => {
    const missing = routes.filter(r =>
      !new RegExp(`^${r}\\s+${r}/\\s+301`, 'm').test(redirects));
    expect(missing).toEqual([]);
  });

  it('301s blog posts by slug', () => {
    expect(redirects).toMatch(/^\/blog\/:slug\s+\/blog\/:slug\/\s+301/m);
  });

  /* chrome.runtime.setUninstallURL points at the bare path, and every extension
   * already installed has that URL stored in the browser forever. It is not in
   * routes.mjs (not public, not sitemapped), so the loop above never checks it. */
  it('301s the bare uninstall-survey URL the extension has hardcoded', () => {
    expect(redirects).toMatch(/^\/uninstall-survey\s+\/uninstall-survey\/\s+301/m);
  });

  it('sends the consolidated posts straight to the canonical target, not through a second hop', () => {
    // These 301 into /loom-alternative/ and /screencastify-alternative/ — the
    // slashed form — so Googlebot resolves them in one hop rather than two.
    for (const [, target] of redirects.matchAll(/^\/blog\/[a-z0-9-]+\/?\s+(\S+)\s+301/gm)) {
      if (target.startsWith('/blog/')) continue;   // the :slug rule itself
      expect(target).toMatch(/\/$/);
    }
  });

  /* The app routes have no file on disk and no rule of their own — the
   * catch-all is the only thing serving them. If it stops being last, every
   * rule after it is dead; if it disappears, so does the entire signed-in app. */
  it('ends with the SPA catch-all, and has exactly one', () => {
    expect(rules.at(-1)).toBe('/*  /index.html  200');
    expect(rules.filter(l => l.startsWith('/*'))).toHaveLength(1);
  });

  /* The regression this whole arrangement exists to prevent. Rules like
   * `/editor*  /index.html  200` look right and do nothing, and while they were
   * present they also stopped the app routes reaching the catch-all. */
  it('has no per-route 200 rewrites, which Pages silently ignores', () => {
    const rewrites = rules.filter(l => /\s200$/.test(l) && !l.startsWith('/*'));
    expect(rewrites).toEqual([]);
  });

  /* Pages downgrades a 404 in this file to 200, so a rule claiming otherwise is
   * worse than none: it reads as a soft-404 defence that is not there. */
  it('has no 404 rule, which Pages downgrades to 200', () => {
    expect(rules.filter(l => /\s404$/.test(l))).toEqual([]);
  });
});

/* A top-level 404.html takes Pages OUT of its SPA assumption: it stops serving
 * index.html for unmatched paths and starts 308ing them to `/`. That is what
 * broke /editor, /login, /v/:id and every other client-only route, so the file
 * must not come back — from the vite build or from public/. */
describe('no 404.html, so Pages stays in SPA mode', () => {
  it('is not emitted by the vite build', () => {
    expect(read('vite.config.ts')).not.toContain('404.html');
  });

  it('is not shipped as a static file', () => {
    expect(globSync('public/404.html')).toEqual([]);
  });

  /* The visible half: unmatched paths answer 200 with the SPA shell, so the
   * only thing keeping a soft 404 out of the index is NotFound's noIndex. */
  it('renders NotFound with noIndex, since the status will be 200', () => {
    expect(read('src/pages/NotFound.tsx')).toMatch(/<SEO\s+noIndex/);
  });
});

/* SEO: internal links added inside blog copy and marketing pages.
 *
 * The 11 posts GSC reported as "crawled — currently not indexed" had, between
 * them, zero in-content links to anywhere else on the site: the only internal
 * links a post carried were the navbar, the footer and an automatic related-
 * posts strip that pointed every post in a category at the same three targets.
 * Contextual links were added to fix that, and they are hand-written strings
 * inside a 3,700-line data file, so a typo'd slug is both easy to make and
 * invisible — it renders as a normal link and 404s only when someone clicks it.
 *
 * The trailing-slash suite above checks the *form* of an internal link. This
 * checks the destination exists. */
describe('in-content internal links point at real destinations', () => {
  const posts = getBlogPosts() as { slug: string }[];
  const slugs = new Set(posts.map(p => p.slug));
  const sources = globSync('src/**/*.{ts,tsx}')
    .filter(f => !f.includes('__tests__'))
    .map(f => ({ file: f, text: read(f) }));

  it('found sources to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('links only to blog slugs that exist', () => {
    const broken = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/["'`]\/blog\/([a-z0-9-]+)\/["'`]/g)]
        .map(m => m[1])
        .filter(slug => !slugs.has(slug))
        .map(slug => `${file} -> /blog/${slug}/`));

    expect([...new Set(broken)]).toEqual([]);
  });

  it('links only to marketing routes that exist', () => {
    const known = new Set<string>(
      (getAllRoutes() as { route: string }[]).map(r => r.route));

    const broken = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/href="(\/[a-z0-9-]+)\/"/g)]
        .map(m => m[1])
        .filter(route => !known.has(route))
        .map(route => `${file} -> ${route}/`));

    expect([...new Set(broken)]).toEqual([]);
  });

  /* Each of the 11 needs somewhere to send its own authority, and a product
   * link is what turns a reader who finished the post into a user. */
  it('gives every affected post at least two blog links and one product link', () => {
    const affected = [
      'how-to-annotate-screenshots-chrome', 'how-to-create-video-bug-report',
      'screenshot-vs-screen-recording-when-to-use', 'how-to-record-presentation-with-webcam',
      'how-to-record-screen-windows-10-free', 'how-to-take-full-page-screenshot-chrome',
      'how-to-screenshot-on-chromebook', 'how-to-record-screen-chrome-free',
      'screen-record-google-meet-free', 'screen-recording-tips-remote-work',
      'record-screen-with-audio-webcam-chrome',
    ];
    const data = read('src/data/blogData.ts');

    const thin = affected.filter(slug => {
      const start = data.indexOf(`slug: '${slug}'`);
      const end = data.indexOf("        slug: '", start + 10);
      const block = data.slice(start, end === -1 ? undefined : end);
      const links = [...block.matchAll(/href="(\/[^"]+)"/g)].map(m => m[1]);
      return links.filter(l => l.startsWith('/blog/')).length < 2
        || links.filter(l => !l.startsWith('/blog/')).length < 1;
    });

    expect(thin).toEqual([]);
  });
});
