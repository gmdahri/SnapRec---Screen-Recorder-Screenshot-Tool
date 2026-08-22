import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
