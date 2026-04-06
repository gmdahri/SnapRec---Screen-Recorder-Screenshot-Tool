# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SnapRec** is a SaaS screen recording and screenshot platform consisting of three apps in an npm workspaces monorepo:

- `apps/extension` — Chrome extension (Manifest V3, plain JS)
- `apps/web` — React 19 + TypeScript frontend (Vite)
- `apps/server` — NestJS backend API

## Commands

Run commands from each app's directory unless noted otherwise.

### Web (`apps/web`)
```bash
npm run dev           # Start dev server
npm run build         # TypeScript check + Vite build
npm run build:prerender  # Build with SSR prerendering
npm run lint          # ESLint
npm run preview       # Preview production build
```

### Server (`apps/server`)
```bash
npm run start:dev     # Watch mode (development)
npm run build         # Compile with nest build
npm run test          # Jest unit tests
npm run test:watch    # Watch mode
npm run test:e2e      # End-to-end tests
npm run lint          # ESLint with auto-fix
npm run migration:run # Run pending TypeORM migrations
npm run migration:generate -- src/migrations/MigrationName  # Generate migration
```

### Extension (`apps/extension`)
Load `apps/extension` as an unpacked extension in Chrome (no build step required — plain JS).

**To create a release zip** (e.g. when user says "create the zip" or "release the extension"):
1. Ask the user for the new version number if not specified
2. Update `"version"` in `apps/extension/manifest.json`
3. Update `"version"` in `apps/extension/package.json`
4. Update (or create) `apps/extension/version.json` — format: `{ "version": "X.Y.Z" }`
5. Run from `apps/extension/`:
```bash
zip -r ../snaprec-extension-vX.Y.Z.zip . --exclude "*.md" --exclude "store_assets/*" --exclude "package.json" --exclude ".DS_Store"
```
Output zip lands at `apps/snaprec-extension-vX.Y.Z.zip`, ready to upload to the Chrome Web Store.

## Architecture

### Data Flow
1. Chrome extension captures screen/tab via `chrome.tabCapture` / `chrome.desktopCapture`
2. Recordings are uploaded directly to Cloudflare R2 (presigned URLs from the NestJS server)
3. The NestJS server stores metadata in PostgreSQL (via Supabase + TypeORM)
4. The web app lets users view, annotate, and share recordings

### Extension (`apps/extension`)
- **`background/`** — Service worker: handles OAuth, upload coordination, messaging between extension components
- **`content/`** — Injected into pages: UI overlays, click tracking, auto-zoom
- **`popup/`** — Extension popup UI
- **`offscreen/`** — Offscreen document for audio mixing and MediaRecorder processing

### Web App (`apps/web/src`)
- **`pages/`** — Route-level components (React Router 7)
- **`components/`** — Shared UI components; Fabric.js canvas used for annotation
- **`hooks/`** — Custom React hooks (data fetching via TanStack Query)
- **`contexts/`** — Auth context wraps Supabase session
- **`lib/`** — API client, utility functions

### Server (`apps/server/src`)
- **`auth/`** — JWT + Passport; Google OAuth flow
- **`recordings/`** — CRUD for recording metadata; presigned URL generation for R2
- **`video-projects/`** — Project grouping for recordings
- **`storage/`** — AWS S3 SDK configured against Cloudflare R2
- **`mail/`** — Resend email integration
- **`scripts/`** — One-off broadcast/utility scripts (run via `npm run script:*`)
- **`migrations/`** — TypeORM migrations; always generate new ones rather than editing existing

### Key External Services
| Service | Used By | Purpose |
|---------|---------|---------|
| Supabase | Server + Web | PostgreSQL database + auth session |
| Cloudflare R2 | Extension + Server | Video/asset object storage |
| Google OAuth | Extension | User authentication |
| Resend | Server | Transactional email |

### Environment Variables
- `apps/web/.env.example` — Supabase URL/key, API base URL, AdSense ID
- `apps/server/.env.example` — Database URL, JWT secret, R2 credentials, Resend key, CORS origin
