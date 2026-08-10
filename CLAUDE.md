# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SnapRec** is a screen recording and screenshot SaaS. npm workspaces monorepo (`apps/*`, `packages/*`):

- `apps/extension` — Chrome extension (Manifest V3, plain JS, no build step)
- `apps/web` — React 19 + TypeScript frontend (Vite), deployed to Cloudflare Pages
- `apps/server` — NestJS backend API, deployed to Google Cloud Run
- `packages/design-system` — `@snaprec/design-system`: the "plate" visual language, shared by web and (from P1) the extension popup

Production: web at `https://www.snaprecorder.org`, API at `https://snaprec-489525905608.us-central1.run.app`.

## Commands

Root shortcuts: `npm run web <script>` and `npm run extension <script>` proxy to the workspace.

### Web (`apps/web`)
```bash
npm run dev              # Vite dev server (localhost:5173)
npm run build            # tsc -b && vite build
npm run build:prerender  # build + puppeteer prerender of ROUTES in prerender.mjs
npm run lint             # ESLint
```

### Server (`apps/server`)
```bash
npm run start:dev        # Watch mode (localhost:3001)
npm run build            # nest build
npm run lint             # ESLint with --fix
npm run test             # Jest (rootDir=src, *.spec.ts)
npx jest src/app.controller.spec.ts        # single test file
npx jest -t "substring of test name"       # single test by name
npm run test:e2e         # test/jest-e2e.json
npm run migration:run    # apply pending migrations (uses src/data-source.ts)
npm run migration:generate -- src/migrations/MigrationName
npm run migration:revert
```
Migration/script commands run TypeScript directly via `ts-node` and read `.env` through `dotenv`, so they need a working DB connection from your shell.

### Extension (`apps/extension`)
Load `apps/extension` unpacked in Chrome — plain JS, nothing to build.

**Release:** use the existing script, don't hand-edit versions:
```bash
./ship-to-store.sh          # auto-increments patch from version.json
./ship-to-store.sh 1.4.0    # explicit version
```
It syncs the version across `version.json`, `package.json`, and `manifest.json`, then writes `apps/snaprec-extension-v<version>.zip` for the Chrome Web Store.

Separately, the service worker polls `${WEB_BASE_URL}/version.json` every 30 minutes to nag users about updates — that file is `apps/web/public/version.json` and must be bumped and deployed with the web app once the new version is live on the store. (It currently lags the extension: 1.2.7 vs 1.3.3.)

## Architecture

### Identity: Supabase is the sole auth authority

The server **never issues tokens**. Supabase (Google OAuth) issues them; the server verifies them:

- `auth/jwt.strategy.ts` validates bearer tokens against Supabase's JWKS endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, ES256). There is no shared JWT secret.
- `JwtAuthGuard` requires a token; `OptionalJwtAuthGuard` allows anonymous callers — used by endpoints that support **guests**.
- The `users` table mirrors Supabase users, keyed by `supabaseId`. `UsersService.findOrCreateBySupabaseId` lazily creates the row (handling the `23505` race) and fires a welcome email. `POST /users/sync` is the explicit entry point.
- Web: `contexts/AuthContext.tsx` wraps the Supabase session. Extension: `background/auth.js` stores the Supabase session in `chrome.storage.local` (`snaprecSession`) after the web app hands it over.

### Guest → claim flow

Anonymous users get a client-generated `guestId`. Recordings, reactions, and comments all accept either a `userId` or a `guestId`. After sign-in, `POST /recordings/claim` transfers ownership of guest-owned recordings to the authenticated user. Any change to ownership logic has to handle both branches.

### Upload path (extension → R2 → server)

1. Extension asks the server for a presigned PUT: `POST /recordings/upload-url` (`background/storage.js`).
2. Extension `PUT`s the blob **directly to Cloudflare R2** — media never transits the NestJS server.
3. Extension posts metadata to `POST /recordings`.
4. `GET /recordings/status/:fileName` polls R2 (`HeadObject`) for readiness; `GET /recordings/stream/:fileName` proxies playback.

`StorageService` is the AWS S3 SDK pointed at R2 (`region: 'auto'`, `forcePathStyle: true`, endpoint derived from `R2_ACCOUNT_ID`). Presigned URLs expire in 1 hour.

### Server modules (`apps/server/src`)
`auth/` (guards + JWKS strategy) · `users/` · `recordings/` (CRUD, presigned URLs, reactions, comments, claim) · `video-projects/` (multi-clip editor projects) · `storage/` (R2) · `mail/` (Resend, templates in `mail/templates/`) · `scripts/` (one-off broadcast emails, run via `npm run script:*`) · `migrations/`.

Entities are registered explicitly in **two** places — `app.module.ts` and `data-source.ts`. Adding an entity means updating both. `synchronize: false` everywhere: schema changes require a generated migration; never edit an applied one. Postgres `timestamp` (OID 1114) is parsed as UTC by a `pg` type parser in `main.ts`.

Global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`, so any request field without a matching DTO property is a 400 — add the property to the DTO, don't work around it.

### Design system (`packages/design-system`)

`src/tokens.css` is the single source of truth for the plate visual language — every colour, control height, radius and duration. Primitives read `var(--sr-*)`; a hex literal in a `.tsx` file is a bug.

`apps/web/src/index.css` imports the tokens and re-exports them through `@theme inline`, so Tailwind utilities generate from the same custom properties rather than a parallel copy. There is no `tailwind.config.js` — Tailwind v4 only loads one via an `@config` directive, and the old file was silently dead, which is why its `primary: #7b25f4` never matched the app's actual purple.

Fonts and icons are bundled, never CDN-loaded: these primitives ship into an MV3 extension page, where remote scripts and styles are CSP-blocked. **Fonts are imported from JS** (`import '@snaprec/design-system/fonts'` in the app entry), not via CSS `@import` — Tailwind inlines CSS imports as text before Vite's asset plugin runs, which leaves fontsource's relative `url(./files/*.woff2)` pointing at the consuming app's source directory, 404ing into a silent `system-ui` fallback.

Coral (`#D8331F` text-bearing, `#FF3B2E` marks) is reserved for live capture and needs-a-response. `StatusChip` accepts only the fixed status vocabulary and `Button`'s `capture` variant is the only coral-filled control — both exist to keep that rule enforceable.

Management surfaces are light-only. Dark is reserved for "Technical" workspaces (the editors), which get explicit dark tokens rather than a `dark:` variant. Do not reintroduce `dark:` utilities.

Run `npm test --workspace=packages/design-system`. The contrast suite parses `tokens.css` and fails if any text pair drops below WCAG AA — it is why `--sr-text-faint-on-light` is `#656E71` rather than the prototype's `#8D989B`, which measures 2.86:1 on paper.

`scripts/render-icons.mjs` regenerates the four extension PNGs from the brand mark. It drives the system Chrome (`channel: 'chrome'`) because the puppeteer browser in this repo's cache is older than puppeteer 24.x expects.

### Extension (`apps/extension`)
- `background/` — MV3 service worker. `background.js` pulls in siblings via `importScripts` in a fixed order (`config.js` first — it defines the global `CONFIG`); these are classic scripts sharing one global scope, not ES modules.
- `content/` — `fab.js`/`fab.css` are auto-injected on all URLs (floating action button); `content.js` is injected on demand for overlays, click tracking, and auto-zoom.
- `offscreen/` — offscreen document for audio mixing and `MediaRecorder` (MV3 service workers can't hold media streams).
- `popup/`, `permission/` — UI surfaces.
- `background/config.js` holds `API_BASE_URL` / `WEB_BASE_URL`. **For local development, swap to the commented-out localhost lines** — and remember to swap back before shipping.

### Web app (`apps/web/src`)
- Data layer lives in `hooks/useRecordings.ts`, not a separate `lib/api`. It exports `fetchWithAuth`, which reads the Supabase session and attaches the access token; base URL is `VITE_API_URL`. TanStack Query wraps everything.
- Two distinct editors: `pages/Editor.tsx` + `hooks/useFabricEditor.ts` (Fabric.js screenshot annotation) and `pages/VideoEditor/` (timeline, trim, zoom, export — its own context in `VideoEditorContext.tsx`).
- Marketing/SEO pages are hand-built React routes; blog posts live as HTML strings in `src/data/blogData.ts`.

### Adding a public-facing route (SEO coupling)

A new marketing or blog page touches four files that are not linked to each other — miss one and the page ships unindexed:

1. `src/App.tsx` — the React Router route
2. `prerender.mjs` — add to `ROUTES` so it gets static HTML
3. `public/sitemap.xml`, and `public/_redirects` if it needs the trailing-slash 301
4. `.github/workflows/indexnow.yml` — the `urlList` submitted to IndexNow on every push to `main`

Blog posts additionally need an entry in `src/data/blogData.ts`. `components/SEO.tsx` (react-helmet-async) supplies the meta tags the prerenderer captures.

## Deployment

- **Server**: root `Dockerfile` (multi-stage, node:22-alpine) builds *only* `apps/server` but copies **every** workspace `package.json` — `apps/*` and `packages/*` alike — in **both** the `build` and `runtime` stages, so `npm ci --workspace=apps/server --include-workspace-root` resolves. Adding a workspace without adding its `COPY` line to both stages breaks the image build with a missing-workspace error. Runs `node apps/server/dist/main.js` on `PORT` (Cloud Run supplies 8080).
- **Web**: Cloudflare Pages serving `apps/web/dist`. `public/_headers` sets HSTS/CSP/etc.; `public/_redirects` handles trailing-slash 301s and the SPA fallback.
- CORS origins come from `ALLOWED_ORIGINS` (comma-separated); the fallback list in `main.ts` covers prod + `localhost:5173`.

## Environment Variables

- `apps/server/.env.example` — discrete `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` (Supabase Postgres, SSL with `rejectUnauthorized: false`), `PORT`, R2 credentials, `SUPABASE_URL` (auth only — no service key, no JWT secret), `ALLOWED_ORIGINS`, `CHROME_STORE_USERS` (surfaced by `GET /stats`), Resend keys.
- `apps/web/.env.example` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, AdSense client + slot IDs.
