import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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
