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

/* SEO: the redirect table has to keep pace with the route list.
 *
 * A new public route added to routes.mjs without its two _redirects lines is
 * invisible until GSC reports it — the bare form 404s on the catch-all instead
 * of 301ing, and the prerendered slashed form has no fallback if prerender has
 * not run. Both were present for all 13 routes when this was written; this is
 * what keeps it that way. */
describe('_redirects covers every public route', () => {
  const redirects = read('public/_redirects');
  const routes: string[] = (read('routes.mjs').match(/route: '(\/[a-z0-9/-]*)'/g) || [])
    .map(m => m.replace(/route: '|'/g, ''))
    .filter(p => p !== '/');

  it('301s the bare form to the canonical trailing-slash form', () => {
    const missing = routes.filter(r =>
      !new RegExp(`^${r}\\s+${r}/\\s+301`, 'm').test(redirects));
    expect(missing).toEqual([]);
  });

  it('serves the canonical form the SPA shell as a 200 fallback', () => {
    const missing = routes.filter(r =>
      !new RegExp(`^${r}/\\s+/index\\.html\\s+200`, 'm').test(redirects));
    expect(missing).toEqual([]);
  });

  it('301s blog posts by slug, above the SPA rewrite that would swallow them', () => {
    expect(redirects).toMatch(/^\/blog\/:slug\s+\/blog\/:slug\/\s+301/m);
    expect(redirects.indexOf('/blog/:slug  /blog/:slug/  301'))
      .toBeLessThan(redirects.indexOf('/blog/*  /index.html  200'));
  });

  it('sends the consolidated posts straight to the canonical target, not through a second hop', () => {
    // These 301 into /loom-alternative/ and /screencastify-alternative/ — the
    // slashed form — so Googlebot resolves them in one hop rather than two.
    for (const [, target] of redirects.matchAll(/^\/blog\/[a-z0-9-]+\/?\s+(\S+)\s+301/gm)) {
      if (target.startsWith('/blog/')) continue;   // the :slug rule itself
      expect(target).toMatch(/\/$/);
    }
  });
});
