import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Emit dist/404.html — a copy of the SPA shell.
 *
 * Two things depend on this file existing, and both were broken without it.
 *
 * Cloudflare Pages decides how to serve the whole project by whether a
 * top-level 404.html is present: "If your project does not include a top-level
 * 404.html file, Pages assumes that you are deploying a single-page
 * application", and in that mode it REDIRECTS every unmatched route to `/`.
 * That is why /editor, /login, /settings and the rest answered 308 -> / in
 * production no matter what public/_redirects said.
 *
 * It is also the only supported way to return a real 404. Pages honours
 * redirects and 200 proxies in _redirects but not 404 rewrites, so the
 * `/*  /index.html  404` rule that used to live there was silently downgraded
 * to 200 and every bad URL was a soft 404.
 *
 * Copied at closeBundle, which runs before prerender.mjs rewrites
 * dist/index.html with the prerendered landing page — so this is the generic
 * shell, not a copy of the homepage. That matters: a 404 that ships the
 * homepage's markup asks Googlebot to treat the two as the same page. React
 * Router renders NotFound into this one on load.
 */
function emit404Shell() {
  return {
    name: 'snaprec-404-shell',
    // After the bundle is written, before prerender touches index.html.
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      const index = resolve(dist, 'index.html')
      if (!existsSync(index)) return
      copyFileSync(index, resolve(dist, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emit404Shell()],
  build: {
    rollupOptions: {
      output: {
        /* SEO W7 — split the 1.8 MB single chunk.
         *
         * Everything except the two lazy editors landed in one `index-*.js`, so a
         * visitor reading a blog post downloaded supabase-js, TanStack Query and
         * the whole iconify runtime before the article could paint. These are the
         * four libraries big enough and stable enough to be worth their own
         * long-cached file; splitting further just adds request overhead.
         *
         * Editor and VideoEditorPage stay as they are — React.lazy in App.tsx
         * already gives them their own chunks, and naming them here would fight
         * that. `fabric` follows the Editor chunk for the same reason.
         *
         * Ordering matters: react-router-dom must be tested before react, or the
         * `react` substring claims it and the router lands in the vendor chunk
         * anyway. Keeping them together is fine either way — they are always
         * loaded as a pair — but being explicit stops that from being accidental. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('@iconify')) return 'icons'
          /* Analytics: dynamically imported in lib/analytics.ts, so this only
           * names the chunk — it stays lazy and off the critical path. Without
           * it the file ships as `module-<hash>.js`, which is impossible to
           * recognise in a network waterfall or a bundle audit. */
          if (id.includes('posthog-js')) return 'posthog'
          if (
            id.includes('react-router') ||
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          ) return 'vendor'
          return
        },
      },
    },
    /* The default 500 kB warning fired constantly and had stopped meaning
     * anything. 700 kB flags a genuine regression instead. */
    chunkSizeWarningLimit: 700,
  },
})
