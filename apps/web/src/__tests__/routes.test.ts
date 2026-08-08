import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

/** Authenticated and auth-adjacent routes are deliberately excluded: they must
 * not be prerendered, sitemapped or submitted to IndexNow. Adding a route here
 * is a decision — the default is that a new route is public and must appear in
 * all four files. */
const NON_PUBLIC = new Set([
  '/login', '/auth/callback',
  '/home', '/library', '/projects', '/shared', '/analytics', '/settings',
  '/dashboard', '/editor', '/video-editor', '/video-preview',
]);

const app = read('src/App.tsx');

const publicRoutes = [...app.matchAll(/path="(\/[a-z0-9\-/]*)"/g)]
  .map(m => m[1])
  .filter(p => p !== '/' && !NON_PUBLIC.has(p) && ![...NON_PUBLIC].some(n => p.startsWith(`${n}/`)));

describe('public route registration', () => {
  it('found some public routes to check', () => {
    expect(publicRoutes.length).toBeGreaterThan(0);
  });

  it('lists every public route in prerender.mjs', () => {
    const routes = read('prerender.mjs');
    expect(publicRoutes.filter(p => !routes.includes(`'${p}'`) && !routes.includes(`"${p}"`)))
      .toEqual([]);
  });

  it('lists every public route in sitemap.xml', () => {
    const sitemap = read('public/sitemap.xml');
    expect(publicRoutes.filter(p => !sitemap.includes(p))).toEqual([]);
  });

  it('lists every public route in the IndexNow workflow', () => {
    const workflow = readFileSync(
      resolve(__dirname, '../../../../.github/workflows/indexnow.yml'), 'utf8');
    expect(publicRoutes.filter(p => !workflow.includes(p))).toEqual([]);
  });
});
