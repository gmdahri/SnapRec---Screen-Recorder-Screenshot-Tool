/* Self-hosted fonts. Never CDN — P1 ships these primitives into an MV3
 * extension page, where remote styles are CSP-blocked.
 *
 * These are JS imports, not a CSS `@import`, on purpose. Tailwind inlines CSS
 * imports as text before Vite's asset plugin runs, which leaves the packages'
 * relative `url(./files/*.woff2)` references pointing at the consuming app's
 * source directory — they 404 and the font silently falls back to system-ui.
 * Importing from JS lets Vite resolve and emit the woff2 files correctly.
 *
 * Import once, from the app entry point.
 */
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/azeret-mono';
