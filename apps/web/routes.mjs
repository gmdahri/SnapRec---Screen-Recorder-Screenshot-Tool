/* SEO W5/W6 — the single public-route list.
 *
 * Four files used to hold their own copy of this: prerender.mjs, public/sitemap.xml,
 * .github/workflows/indexnow.yml and (partially) src/__tests__/routes.test.ts. The
 * blog slugs were duplicated a fourth and fifth time, which is why IndexNow was
 * submitting 10 of 35 posts. prerender.mjs, scripts/generate-sitemap.mjs and the
 * IndexNow workflow now all derive from here, and the blog half is read straight
 * out of src/data/blogData.ts so a new post cannot be forgotten.
 *
 * Plain .mjs, not .ts: prerender.mjs and the build scripts run under bare node
 * with no compile step, and adding ts-node to the web build for one file is worse
 * than parsing the post list with a regex.
 */

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SITE_URL = 'https://www.snaprecorder.org';

/** Public, indexable, non-blog routes, each paired with the source file whose last
 * commit date is the honest `<lastmod>` for it. Anything not listed here is either
 * auth-gated or robots-disallowed — see NON_PUBLIC in src/__tests__/routes.test.ts. */
export const STATIC_ROUTES = [
  { route: '/', source: 'src/pages/Landing.tsx' },
  { route: '/how-it-works', source: 'src/pages/HowItWorks.tsx' },
  { route: '/changelog', source: 'src/pages/Changelog.tsx' },
  { route: '/privacy', source: 'src/pages/Privacy.tsx' },
  { route: '/about', source: 'src/pages/About.tsx' },
  { route: '/terms', source: 'src/pages/Terms.tsx' },
  { route: '/contact', source: 'src/pages/Contact.tsx' },
  { route: '/blog', source: 'src/data/blogData.ts' },
  { route: '/about/ghulam-muhammad', source: 'src/pages/AuthorPage.tsx' },
  { route: '/loom-alternative', source: 'src/pages/LoomAlternative.tsx' },
  { route: '/screencastify-alternative', source: 'src/pages/ScreencastifyAlternative.tsx' },
  { route: '/webcam-overlay-presentation', source: 'src/pages/WebcamOverlayPresentation.tsx' },
  { route: '/screen-recorder-for-teachers', source: 'src/pages/ScreenRecorderForTeachers.tsx' },
];

/** Blog posts, parsed out of blogData.ts.
 *
 * Splits the file on `slug:` boundaries so each post's `date` and `updatedDate`
 * are read from that post's own block — reading forward from a slug would happily
 * pick up the next post's dates. Throws on a count mismatch or an unparseable
 * date rather than silently dropping posts out of the sitemap. */
export function getBlogPosts() {
  const src = readFileSync(resolve(__dirname, 'src/data/blogData.ts'), 'utf8');

  const slugRe = /^[ \t]*slug: '([a-z0-9-]+)',$/gm;
  const marks = [];
  let match;
  while ((match = slugRe.exec(src)) !== null) {
    marks.push({ slug: match[1], index: match.index });
  }
  if (marks.length === 0) throw new Error('[routes] parsed zero blog posts from blogData.ts');

  const posts = marks.map(({ slug, index }, i) => {
    const block = src.slice(index, marks[i + 1]?.index ?? src.length);
    const date = /^[ \t]*date: '(\d{4}-\d{2}-\d{2})',$/m.exec(block)?.[1];
    const updatedDate = /^[ \t]*updatedDate: '(\d{4}-\d{2}-\d{2})',$/m.exec(block)?.[1];

    if (!date) throw new Error(`[routes] post '${slug}' has no parseable date`);

    return { slug, date, updatedDate, lastmod: updatedDate ?? date };
  });

  const declared = (src.match(/^[ \t]*slug: '[a-z0-9-]+',$/gm) || []).length;
  if (posts.length !== declared) {
    throw new Error(`[routes] parsed ${posts.length} posts but blogData.ts declares ${declared}`);
  }

  return posts;
}

/** Every public route, in prerender and sitemap order. */
export function getAllRoutes() {
  const blog = getBlogPosts().map(p => ({ route: `/blog/${p.slug}`, lastmod: p.lastmod }));
  const staticRoutes = STATIC_ROUTES.map(r => ({ route: r.route, lastmod: lastCommitDate(r.source) }));

  // /blog and / lead, then the comparison pages, then posts — mirrors the old
  // hand-written order so sitemap diffs stay readable.
  const bySlash = staticRoutes.findIndex(r => r.route === '/blog');
  return [
    ...staticRoutes.slice(0, bySlash + 1),
    ...blog,
    ...staticRoutes.slice(bySlash + 1),
  ];
}

/** The route as it appears in the sitemap and in canonical tags: trailing slash. */
export function toAbsoluteUrl(route) {
  return route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}/`;
}

/** git's last commit date for a file, as YYYY-MM-DD.
 *
 * A real edit date beats stamping today on every build — `lastmod` that always
 * says "now" is the kind of signal Google learns to ignore. Falls back to today
 * when git is unavailable (shallow clone, tarball, some CI images). */
function lastCommitDate(relPath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', relPath], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    // fall through
  }
  return new Date().toISOString().slice(0, 10);
}
