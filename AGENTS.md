# Repository Guidelines

## Project Structure & Module Organization

SnapRec is an npm-workspaces monorepo. `apps/web` contains the React 19/Vite frontend; code is under `src`, assets under `public`, and tests under `src/__tests__`. `apps/server` is the NestJS API, organized by feature in `src`; unit tests use `*.spec.ts`, while end-to-end tests live in `test`. `apps/extension` is a plain-JavaScript Manifest V3 extension with `background`, `content`, `popup`, `offscreen`, and `tests` directories. Shared React primitives and design tokens live in `packages/design-system/src`. Architecture notes and plans are in `docs`.

## Build, Test, and Development Commands

- `npm install` installs all workspace dependencies.
- `npm run web -- dev` starts Vite on port 5173; `npm run web -- build` type-checks and builds it.
- `npm run start:dev --workspace=apps/server` starts the API in watch mode on port 3001.
- `npm run build --workspace=apps/server` compiles the NestJS service.
- `npm test --workspace=apps/web`, `apps/extension`, or `packages/design-system` runs Vitest for that workspace.
- `npm test --workspace=apps/server` runs Jest; use `test:e2e` or `test:cov` for integration tests or coverage.
- `npm run lint --workspace=apps/web` and `npm run lint --workspace=apps/server` run ESLint.

Load `apps/extension` unpacked in Chrome; it has no build step.

## Coding Style & Naming Conventions

Follow existing TypeScript/React and NestJS patterns, with two-space indentation and Prettier-compatible formatting. Use `PascalCase` for components and classes, `camelCase` for functions and variables, and descriptive kebab-case NestJS filenames such as `create-recording.dto.ts`. Keep feature tests beside source or in the existing `__tests__` directory. Design-system components must consume `--sr-*` tokens; do not add hard-coded hex colors or `dark:` utilities.

## Testing Guidelines

Add focused tests for behavioral changes. Name Vitest files `*.test.ts(x)` and server Jest files `*.spec.ts`; extension tests belong in `apps/extension/tests`. Run the affected workspace suite before opening a PR. No numeric coverage threshold is enforced, but server coverage can be reviewed with `test:cov`.

## Commit & Pull Request Guidelines

History follows Conventional Commits with scopes, for example `feat(extension): add camera controls` or `fix(web): correct recording view`. Keep commits narrowly scoped and imperative. PRs should explain user impact, list verification commands, link relevant issues, and include screenshots or recordings for UI changes. Call out environment, migration, or deployment changes explicitly.

## Security & Configuration

Copy workspace `.env.example` files locally and never commit credentials. Database schema changes require TypeORM migrations; never enable `synchronize` or edit an applied migration. When adding an entity, register it in both `app.module.ts` and `data-source.ts`.
