# P0 Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@snaprec/design-system` — the plate system's tokens, fonts, icons and React primitives — and adopt it in `apps/web`, so P1 (extension) and P2 (share/completion) have a shared vocabulary to build on.

**Architecture:** A new npm workspace package holds `tokens.css` as the single source of truth for every colour, height and duration. React primitives consume those custom properties; they never hardcode hex. `apps/web` imports the same file and re-exports it into Tailwind via `@theme inline`, so utilities generate from the tokens rather than a parallel copy. Fonts and icons are bundled, never CDN-loaded, because P1 ships into an MV3 extension where CSP forbids remote scripts and styles.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind v4, Vite 7, Vitest 3 + Testing Library, `@fontsource-variable/*`, `@iconify/react` + `@iconify-json/ant-design`, puppeteer (already present in `apps/web`) for icon rasterisation.

## Global Constraints

- **Spec of record:** `docs/superpowers/specs/2026-08-05-plate-redesign-p0-p2-design.md`. Where this plan and the spec disagree, stop and ask.
- **No Ant Design library.** Icons come from `@iconify-json/ant-design` only.
- **No CDN at runtime.** No `<iconify-icon>` web component, no Google Fonts `<link>`. Everything bundled.
- **Radius is `0` on media and rails, `2px` on controls. No other radius may be introduced.**
- **Control heights are exactly 30 / 34 / 40 / 46.** No other heights.
- **Motion durations are exactly 120 / 180 / 220ms**, easing `cubic-bezier(.2,.8,.2,1)`.
- **Coral (`#D8331F` text-bearing, `#FF3B2E` marks) is reserved for live capture and needs-a-response.** No other use, ever.
- **Cyan foreground on cyan fill is `#03252B`** — never white.
- **Status strings are fixed and never paraphrased:** `on this device`, `uploading`, `saved to library`, `link ready`, `processing`, `private`, `shared`, `needs a reply`.
- **Primitives read `var(--sr-*)`.** A hex literal in a `.tsx` file is a bug.
- **Every task ends with a commit.** Do not push.

### Deviation from spec §8, accepted

The spec says verification is "manual plus build gates" and flags test infrastructure as a scope addition to raise. This plan adds **Vitest scoped to `packages/design-system` only** — it does not retrofit `apps/web` or `apps/server`. Rationale: the spec itself requires a token-contrast gate, and primitives without a test cycle cannot be reviewed task-by-task. If this is unwanted, say so before Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/design-system/package.json` | Workspace manifest, deps, `test`/`build` scripts |
| `packages/design-system/tsconfig.json` | TS config for the package |
| `packages/design-system/vitest.config.ts` | jsdom environment, CSS handling |
| `packages/design-system/src/tokens.css` | **Single source of truth** for all tokens |
| `packages/design-system/src/fonts.css` | `@font-face` via fontsource imports |
| `packages/design-system/src/icons.ts` | Named re-exports of the ant-design icons in use |
| `packages/design-system/src/motion.ts` | Duration + easing constants |
| `packages/design-system/src/status.ts` | The fixed status vocabulary as a union type |
| `packages/design-system/src/primitives/*.tsx` | One primitive per file |
| `packages/design-system/src/index.ts` | Public barrel |
| `packages/design-system/scripts/render-icons.mjs` | Rasterises the SVG mark to extension PNGs |
| `apps/web/src/index.css` | Imports tokens, maps them into Tailwind via `@theme inline` |
| `apps/web/index.html` | Font links removed, favicon swapped |
| `Dockerfile`, `.dockerignore` | New workspace made visible to the server image build |

---

## Task 1: Scaffold the package, author tokens, gate them on contrast

**Files:**
- Create: `packages/design-system/package.json`
- Create: `packages/design-system/tsconfig.json`
- Create: `packages/design-system/vitest.config.ts`
- Create: `packages/design-system/src/tokens.css`
- Create: `packages/design-system/src/__tests__/contrast.test.ts`
- Modify: `Dockerfile` (both stages)
- Modify: `.dockerignore`

**Interfaces:**
- Consumes: nothing
- Produces: `packages/design-system/src/tokens.css` exposing custom properties named `--sr-<group>-<name>`. Every later task reads these. Group names are exactly: `surface`, `border`, `text`, `cyan`, `coral`, `green`, `h` (control heights), `radius`, `dur`, `ease`.

- [ ] **Step 1: Create the workspace manifest**

`packages/design-system/package.json`:

```json
{
  "name": "@snaprec/design-system",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./fonts.css": "./src/fonts.css"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@iconify/react": "^6.0.2",
    "@iconify/types": "^2.0.0",
    "@iconify-json/ant-design": "^1.2.8",
    "@fontsource-variable/schibsted-grotesk": "^5.3.0",
    "@fontsource-variable/azeret-mono": "^5.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.2.5",
    "@vitejs/plugin-react": "^5.1.1",
    "jsdom": "^25.0.1",
    "typescript": "~5.9.3",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create the TS and Vitest configs**

`packages/design-system/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`packages/design-system/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Required: the primitive tests render JSX, which esbuild will not transform
  // correctly without the React plugin.
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
  },
});
```

`packages/design-system/src/__tests__/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing contrast test**

This test parses `tokens.css` directly, so the CSS file stays the single source of truth — there is no JS copy of the palette to drift.

`packages/design-system/src/__tests__/contrast.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = fileURLToPath(new URL('../tokens.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

function tokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--sr-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const T = tokens();

/** Every pair here carries text and must clear WCAG AA (4.5:1). */
const TEXT_PAIRS: Array<[string, string]> = [
  ['--sr-text-primary-on-light', '--sr-surface-paper'],
  ['--sr-text-secondary-on-light', '--sr-surface-paper'],
  ['--sr-text-muted-on-light', '--sr-surface-paper'],
  ['--sr-text-faint-on-light', '--sr-surface-paper'],
  ['--sr-text-primary-on-light', '--sr-surface-panel-light'],
  ['--sr-text-faint-on-light', '--sr-surface-panel-light'],
  ['--sr-text-primary-on-dark', '--sr-surface-carbon'],
  ['--sr-text-secondary-on-dark', '--sr-surface-carbon'],
  ['--sr-text-muted-on-dark', '--sr-surface-carbon'],
  ['--sr-text-faint-on-dark', '--sr-surface-carbon'],
  ['--sr-cyan-on-light', '--sr-surface-paper'],
  ['--sr-cyan-fg', '--sr-cyan'],
  ['--sr-coral-text-fg', '--sr-coral-text'],
];

describe('token contrast', () => {
  it('parses tokens from tokens.css', () => {
    expect(Object.keys(T).length).toBeGreaterThan(20);
  });

  it.each(TEXT_PAIRS)('%s on %s clears WCAG AA', (fg, bg) => {
    expect(T[fg], `${fg} missing from tokens.css`).toBeDefined();
    expect(T[bg], `${bg} missing from tokens.css`).toBeDefined();
    expect(contrast(T[fg], T[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the faint-on-light token distinct from faint-on-dark', () => {
    // #8D989B reads at 2.86:1 on paper — legible only on carbon.
    expect(T['--sr-text-faint-on-light']).not.toBe(T['--sr-text-faint-on-dark']);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm install
npm test --workspace=packages/design-system
```

Expected: FAIL — `tokens.css` does not exist, so the `readFileSync` throws `ENOENT`.

- [ ] **Step 5: Author tokens.css**

`packages/design-system/src/tokens.css`:

```css
/* SnapRec — the plate.
 * Single source of truth. Primitives read these; nothing hardcodes hex.
 * Values are normative, from the Plate Prototype's "Shared, not re-decided" panel.
 */
:root {
  /* Surfaces — dark (capture) */
  --sr-surface-carbon: #0C1011;
  --sr-surface-well: #040708;
  --sr-surface-panel-dark: #14191B;
  --sr-surface-panel-dark-alt: #101416;

  /* Surfaces — light (management) */
  --sr-surface-paper: #FAFBFB;
  --sr-surface-panel-light: #EEF1F1;

  /* Borders */
  --sr-border-dark: #2A3234;
  --sr-border-dark-soft: #22292B;
  --sr-border-dark-strong: #3A4245;
  --sr-border-light: #C7CFD0;
  --sr-border-light-soft: #DCE1E2;

  /* Text on dark */
  --sr-text-primary-on-dark: #F3F6F6;
  --sr-text-secondary-on-dark: #C1CACC;
  --sr-text-muted-on-dark: #9BA5A8;
  --sr-text-faint-on-dark: #8D989B;

  /* Text on light.
   * faint is #6B7477, NOT #8D989B: the prototype uses #8D989B on both
   * surfaces, but on paper it measures 2.86:1 and fails AA. */
  --sr-text-primary-on-light: #0C1011;
  --sr-text-secondary-on-light: #2B3234;
  --sr-text-muted-on-light: #4B5457;
  --sr-text-faint-on-light: #6B7477;

  /* Cyan — focus, selection, sharing */
  --sr-cyan: #06A6C0;
  --sr-cyan-hover: #0FBBD6;
  --sr-cyan-fg: #03252B;
  --sr-cyan-on-light: #0A7F94;
  --sr-cyan-tint: #DFF4F8;
  --sr-focus-ring: 0 0 0 3px rgba(6, 166, 192, .18);

  /* Coral — live capture and needs-a-response ONLY */
  --sr-coral-text: #D8331F;
  --sr-coral-text-fg: #FFFFFF;
  --sr-coral-mark: #FF3B2E;
  --sr-coral-hover: #B82A18;
  --sr-coral-on-dark: #FF7A6E;

  /* Completion */
  --sr-green: #1F9D62;

  /* Control heights — these four, no others */
  --sr-h-xs: 30px;
  --sr-h-sm: 34px;
  --sr-h-md: 40px;
  --sr-h-lg: 46px;

  /* Radius — 0 on media and rails, 2 on controls */
  --sr-radius-none: 0px;
  --sr-radius-control: 2px;

  /* Motion */
  --sr-dur-fast: 120ms;
  --sr-dur-mid: 180ms;
  --sr-dur-slow: 220ms;
  --sr-ease: cubic-bezier(.2, .8, .2, 1);

  /* Type */
  --sr-font-ui: 'Schibsted Grotesk Variable', system-ui, sans-serif;
  --sr-font-mono: 'Azeret Mono Variable', ui-monospace, monospace;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --sr-dur-fast: 0ms;
    --sr-dur-mid: 0ms;
    --sr-dur-slow: 0ms;
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system
```

Expected: PASS, 15 assertions. If any pair fails, **do not loosen the threshold** — darken the token and note it in the CSS comment, as was done for `--sr-text-faint-on-light`.

- [ ] **Step 7: Make the new workspace visible to the Docker build**

Without this, `npm ci --workspace=apps/server` fails because the lockfile references a workspace whose manifest was never copied into the image.

In `Dockerfile`, in **both** the `build` and `runtime` stages, after the `COPY apps/extension/package.json ...` line, add:

```dockerfile
COPY packages/design-system/package.json packages/design-system/package.json
```

In `.dockerignore`, after the `apps/web/*` block, add:

```
packages/*
!packages/design-system/package.json
```

- [ ] **Step 8: Verify the server image still builds**

```bash
docker build -t snaprec-server-check .
```

Expected: build succeeds through both stages. If `npm ci` errors with a missing workspace, the `COPY` line is in only one stage.

- [ ] **Step 9: Commit**

```bash
git add packages/design-system Dockerfile .dockerignore package-lock.json
git commit -m "feat(design-system): scaffold package with plate tokens and contrast gate"
```

---

## Task 2: Fonts and icons, bundled

**Files:**
- Create: `packages/design-system/src/fonts.css`
- Create: `packages/design-system/src/icons.ts`
- Create: `packages/design-system/src/__tests__/icons.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime
- Produces: `icons.ts` exporting a frozen `icons` record whose keys are the semantic names used by every later task — `record`, `screenshot`, `settings`, `chrome`, `desktop`, `expand`, `audio`, `audioMuted`, `sound`, `user`, `eyeInvisible`, `pause`, `play`, `reload`, `highlight`, `holder`, `copy`, `download`, `scissor`, `cloudUpload`, `delete`, `close`, `check`, `link`, `like`, `fileText`, `fullscreen`, `arrowLeft`, `right`, `down`, `borderless`, `borderOuter`, `verticalAlignBottom`, `playCircle`. Consumers pass these to `@iconify/react`'s `<Icon icon={...} />`.

- [ ] **Step 1: Write the failing icons test**

This catches a mistyped icon name at test time rather than as a blank square in production.

`packages/design-system/src/__tests__/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { icons } from '../icons';

describe('icons', () => {
  it('exports every icon the plate surfaces use', () => {
    expect(Object.keys(icons).length).toBeGreaterThanOrEqual(30);
  });

  it.each(Object.entries(icons))('%s resolves to a real iconify icon', (_name, icon) => {
    expect(icon).toBeDefined();
    expect(typeof (icon as { body: string }).body).toBe('string');
    expect((icon as { body: string }).body.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- icons
```

Expected: FAIL — `Cannot find module '../icons'`.

- [ ] **Step 3: Write icons.ts**

```ts
import type { IconifyIcon } from '@iconify/types';
import { icons as antd } from '@iconify-json/ant-design';

/** Pull one icon out of the bundled ant-design set at module load. */
function pick(name: string): IconifyIcon {
  const raw = antd.icons[name];
  if (!raw) throw new Error(`ant-design icon "${name}" does not exist`);
  return {
    body: raw.body,
    width: raw.width ?? antd.width ?? 1024,
    height: raw.height ?? antd.height ?? 1024,
  };
}

export const icons = Object.freeze({
  record: pick('video-camera-outlined'),
  screenshot: pick('camera-outlined'),
  settings: pick('setting-outlined'),
  chrome: pick('chrome-outlined'),
  desktop: pick('desktop-outlined'),
  expand: pick('expand-outlined'),
  audio: pick('audio-outlined'),
  audioMuted: pick('audio-muted-outlined'),
  sound: pick('sound-outlined'),
  user: pick('user-outlined'),
  eyeInvisible: pick('eye-invisible-outlined'),
  pause: pick('pause-outlined'),
  play: pick('caret-right-outlined'),
  reload: pick('reload-outlined'),
  highlight: pick('highlight-outlined'),
  holder: pick('holder-outlined'),
  copy: pick('copy-outlined'),
  download: pick('download-outlined'),
  scissor: pick('scissor-outlined'),
  cloudUpload: pick('cloud-upload-outlined'),
  delete: pick('delete-outlined'),
  close: pick('close-outlined'),
  check: pick('check-outlined'),
  link: pick('link-outlined'),
  like: pick('like-outlined'),
  fileText: pick('file-text-outlined'),
  fullscreen: pick('fullscreen-outlined'),
  arrowLeft: pick('arrow-left-outlined'),
  right: pick('right-outlined'),
  down: pick('down-outlined'),
  borderless: pick('borderless-table-outlined'),
  borderOuter: pick('border-outer-outlined'),
  verticalAlignBottom: pick('vertical-align-bottom-outlined'),
  playCircle: pick('play-circle-outlined'),
});

export type IconName = keyof typeof icons;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system -- icons
```

Expected: PASS. If `pick` throws for a name, the ant-design set uses a different slug — look it up in `node_modules/@iconify-json/ant-design/icons.json` and correct the string. Do **not** substitute a different icon.

- [ ] **Step 5: Write fonts.css**

```css
/* Self-hosted. Never CDN — P1 ships into MV3, where remote styles are CSP-blocked. */
@import '@fontsource-variable/schibsted-grotesk/index.css';
@import '@fontsource-variable/azeret-mono/index.css';
```

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src/fonts.css packages/design-system/src/icons.ts packages/design-system/src/__tests__/icons.test.ts
git commit -m "feat(design-system): bundle plate fonts and ant-design icon subset"
```

---

## Task 3: The brand mark

**Files:**
- Create: `packages/design-system/src/primitives/Logo.tsx`
- Create: `packages/design-system/src/__tests__/Logo.test.tsx`

**Interfaces:**
- Consumes: `--sr-cyan`, `--sr-coral-mark` from Task 1
- Produces: `<Logo size?: number, withWordmark?: boolean, title?: string />`. The mark is two corner brackets plus a coral square, drawn on a 14×14 grid. Brackets inherit `currentColor`; the square is always coral.

- [ ] **Step 1: Write the failing test**

`packages/design-system/src/__tests__/Logo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from '../primitives/Logo';

describe('Logo', () => {
  it('renders an accessible image role with a default title', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'SnapRec' })).toBeInTheDocument();
  });

  it('renders the wordmark when asked', () => {
    render(<Logo withWordmark />);
    expect(screen.getByText('SnapRec')).toBeInTheDocument();
  });

  it('omits the wordmark by default', () => {
    render(<Logo />);
    expect(screen.queryByText('SnapRec')).not.toBeInTheDocument();
  });

  it('draws the capture dot in coral', () => {
    const { container } = render(<Logo />);
    const dot = container.querySelector('[data-part="dot"]');
    expect(dot).toHaveAttribute('fill', 'var(--sr-coral-mark)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- Logo
```

Expected: FAIL — `Cannot find module '../primitives/Logo'`.

- [ ] **Step 3: Implement Logo.tsx**

```tsx
export interface LogoProps {
  /** Height of the mark in px. Default 14, matching the popup header. */
  size?: number;
  withWordmark?: boolean;
  title?: string;
  className?: string;
}

export function Logo({ size = 14, withWordmark = false, title = 'SnapRec', className }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      role="img"
      aria-label={withWordmark ? undefined : title}
      aria-hidden={withWordmark || undefined}
      focusable="false"
    >
      {!withWordmark && <title>{title}</title>}
      {/* top-left bracket */}
      <path d="M0 6V0h6" fill="none" stroke="var(--sr-cyan)" strokeWidth="2" />
      {/* bottom-right bracket */}
      <path d="M14 8v6H8" fill="none" stroke="var(--sr-cyan)" strokeWidth="2" />
      {/* capture dot */}
      <rect data-part="dot" x="5" y="5" width="4" height="4" fill="var(--sr-coral-mark)" />
    </svg>
  );

  if (!withWordmark) return <span className={className}>{mark}</span>;

  return (
    <span
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, letterSpacing: '-.01em' }}
    >
      {mark}
      <span>{title}</span>
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system -- Logo
```

Expected: PASS, 4 assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src/primitives/Logo.tsx packages/design-system/src/__tests__/Logo.test.tsx
git commit -m "feat(design-system): add plate brand mark as inline SVG"
```

---

## Task 4: Button and IconButton

**Files:**
- Create: `packages/design-system/src/primitives/Button.tsx`
- Create: `packages/design-system/src/primitives/IconButton.tsx`
- Create: `packages/design-system/src/__tests__/Button.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1, `icons` from Task 2
- Produces:
  - `<Button variant='primary'|'secondary'|'ghost'|'capture'|'carbon' size={30|34|40|46} surface='light'|'dark' />`, extending `ButtonHTMLAttributes<HTMLButtonElement>`
  - `<IconButton icon={IconifyIcon} label={string} surface='light'|'dark' />` — `label` is required and becomes both `aria-label` and `title`

- [ ] **Step 1: Write the failing test**

`packages/design-system/src/__tests__/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { icons } from '../icons';

describe('Button', () => {
  it('defaults to the 34px control height', () => {
    render(<Button>Save to library</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ height: 'var(--sr-h-sm)' });
  });

  it('uses coral only for the capture variant', () => {
    const { rerender } = render(<Button variant="capture">Start recording</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--sr-coral-text)' });

    rerender(<Button variant="primary">Upload and get link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--sr-cyan)' });
  });

  it('puts cyan-safe foreground on the primary fill', () => {
    render(<Button variant="primary">Upload and get link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ color: 'var(--sr-cyan-fg)' });
  });

  it('applies the 2px control radius, never a larger one', () => {
    render(<Button>Copy link</Button>);
    expect(screen.getByRole('button')).toHaveStyle({ borderRadius: 'var(--sr-radius-control)' });
  });
});

describe('IconButton', () => {
  it('requires and exposes an accessible name', () => {
    render(<IconButton icon={icons.pause} label="Pause" />);
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('title', 'Pause');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- Button
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement Button.tsx**

```tsx
import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'capture' | 'carbon';
export type ControlHeight = 30 | 34 | 40 | 46;
export type Surface = 'light' | 'dark';

const HEIGHT: Record<ControlHeight, string> = {
  30: 'var(--sr-h-xs)',
  34: 'var(--sr-h-sm)',
  40: 'var(--sr-h-md)',
  46: 'var(--sr-h-lg)',
};

function paint(variant: ButtonVariant, surface: Surface): CSSProperties {
  const border = surface === 'dark' ? 'var(--sr-border-dark-strong)' : 'var(--sr-border-light)';
  const ink = surface === 'dark' ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-primary-on-light)';
  const quiet = surface === 'dark' ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-muted-on-light)';

  switch (variant) {
    case 'primary':
      return { background: 'var(--sr-cyan)', color: 'var(--sr-cyan-fg)', border: '1px solid var(--sr-cyan)' };
    case 'capture':
      return { background: 'var(--sr-coral-text)', color: 'var(--sr-coral-text-fg)', border: '1px solid var(--sr-coral-text)' };
    case 'carbon':
      return { background: 'var(--sr-surface-carbon)', color: 'var(--sr-text-primary-on-dark)', border: '1px solid var(--sr-border-dark-strong)' };
    case 'ghost':
      return { background: 'transparent', color: quiet, border: '1px solid transparent' };
    case 'secondary':
    default:
      return { background: 'transparent', color: ink, border: `1px solid ${border}` };
  }
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlHeight;
  surface?: Surface;
}

export function Button({
  variant = 'secondary',
  size = 34,
  surface = 'light',
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        height: HEIGHT[size],
        padding: '0 14px',
        borderRadius: 'var(--sr-radius-control)',
        fontFamily: 'var(--sr-font-ui)',
        fontSize: 13,
        fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: `background var(--sr-dur-fast) var(--sr-ease), border-color var(--sr-dur-fast) var(--sr-ease)`,
        ...paint(variant, surface),
        ...style,
      }}
    />
  );
}
```

- [ ] **Step 4: Implement IconButton.tsx**

```tsx
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/types';
import type { ButtonHTMLAttributes } from 'react';
import type { Surface } from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconifyIcon;
  /** Required. Becomes both the accessible name and the tooltip. */
  label: string;
  size?: number;
  surface?: Surface;
}

export function IconButton({ icon, label, size = 15, surface = 'light', style, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      style={{
        width: 'var(--sr-h-xs)',
        height: 'var(--sr-h-xs)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--sr-radius-control)',
        cursor: 'pointer',
        color: surface === 'dark' ? 'var(--sr-text-secondary-on-dark)' : 'var(--sr-text-muted-on-light)',
        ...style,
      }}
    >
      <Icon icon={icon} width={size} />
    </button>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system -- Button
```

Expected: PASS, 5 assertions.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src/primitives/Button.tsx packages/design-system/src/primitives/IconButton.tsx packages/design-system/src/__tests__/Button.test.tsx
git commit -m "feat(design-system): add Button and IconButton primitives"
```

---

## Task 5: Frame — the three treatments

**Files:**
- Create: `packages/design-system/src/primitives/Frame.tsx`
- Create: `packages/design-system/src/__tests__/Frame.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1
- Produces: `<Frame treatment='editable'|'focused'|'passive' readout?: string surface?: Surface>{children}</Frame>`. `editable` renders six solid cyan handles (four corners plus top and bottom mid-edge) sitting **on** the boundary; `focused` renders four hairline registration marks **inset** 5–7px; `passive` renders none.

- [ ] **Step 1: Write the failing test**

`packages/design-system/src/__tests__/Frame.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Frame } from '../primitives/Frame';

function marks(container: HTMLElement) {
  return container.querySelectorAll('[data-part="mark"]');
}

describe('Frame', () => {
  it('gives editable frames six solid handles', () => {
    const { container } = render(<Frame treatment="editable" />);
    expect(marks(container)).toHaveLength(6);
  });

  it('gives focused frames four inset registration marks', () => {
    const { container } = render(<Frame treatment="focused" />);
    expect(marks(container)).toHaveLength(4);
  });

  it('gives passive frames no marks at all', () => {
    const { container } = render(<Frame treatment="passive" />);
    expect(marks(container)).toHaveLength(0);
  });

  it('shows a dimension readout only for editable frames', () => {
    const { queryByText, rerender } = render(<Frame treatment="editable" readout="840 × 525" />);
    expect(queryByText('840 × 525')).toBeInTheDocument();

    rerender(<Frame treatment="focused" readout="840 × 525" />);
    expect(queryByText('840 × 525')).not.toBeInTheDocument();
  });

  it('renders its children', () => {
    const { getByTestId } = render(
      <Frame treatment="passive"><img data-testid="media" alt="" /></Frame>
    );
    expect(getByTestId('media')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- Frame
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Frame.tsx**

```tsx
import type { CSSProperties, ReactNode } from 'react';
import type { Surface } from './Button';

export type FrameTreatment = 'editable' | 'focused' | 'passive';

export interface FrameProps {
  treatment: FrameTreatment;
  /** Live dimension read-out. Rendered for editable frames only. */
  readout?: string;
  surface?: Surface;
  children?: ReactNode;
  style?: CSSProperties;
}

const HANDLE = 9;
const MARK = 11;

/** Solid handles sit ON the boundary — they signal "this can be resized". */
function editableHandles(): CSSProperties[] {
  const off = -(HANDLE / 2);
  return [
    { left: off, top: off },
    { right: off, top: off },
    { left: off, bottom: off },
    { right: off, bottom: off },
    { left: '50%', top: off, marginLeft: off },
    { left: '50%', bottom: off, marginLeft: off },
  ];
}

/** Registration marks sit INSET — passive, never on the boundary. */
function focusedMarks(): CSSProperties[] {
  const c = 'var(--sr-cyan)';
  return [
    { left: 6, top: 6, borderLeft: `1px solid ${c}`, borderTop: `1px solid ${c}` },
    { right: 6, top: 6, borderRight: `1px solid ${c}`, borderTop: `1px solid ${c}` },
    { left: 6, bottom: 6, borderLeft: `1px solid ${c}`, borderBottom: `1px solid ${c}` },
    { right: 6, bottom: 6, borderRight: `1px solid ${c}`, borderBottom: `1px solid ${c}` },
  ];
}

export function Frame({ treatment, readout, surface = 'light', children, style }: FrameProps) {
  const outline =
    treatment === 'editable'
      ? '1px solid var(--sr-cyan)'
      : `1px solid ${surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)'}`;

  const parts =
    treatment === 'editable' ? editableHandles() : treatment === 'focused' ? focusedMarks() : [];

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--sr-surface-well)',
        outline,
        borderRadius: 'var(--sr-radius-none)',
        ...style,
      }}
    >
      {children}
      {parts.map((p, i) => (
        <span
          key={i}
          data-part="mark"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: treatment === 'editable' ? HANDLE : MARK,
            height: treatment === 'editable' ? HANDLE : MARK,
            background: treatment === 'editable' ? 'var(--sr-cyan)' : 'transparent',
            ...p,
          }}
        />
      ))}
      {treatment === 'editable' && readout && (
        <span
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            fontFamily: 'var(--sr-font-mono)',
            fontSize: 9.5,
            color: 'var(--sr-cyan-fg)',
            background: 'var(--sr-cyan)',
            padding: '2px 5px',
          }}
        >
          {readout}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system -- Frame
```

Expected: PASS, 5 assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src/primitives/Frame.tsx packages/design-system/src/__tests__/Frame.test.tsx
git commit -m "feat(design-system): add Frame with editable/focused/passive treatments"
```

---

## Task 6: Status vocabulary, StatusChip and PathSpine

**Files:**
- Create: `packages/design-system/src/status.ts`
- Create: `packages/design-system/src/primitives/StatusChip.tsx`
- Create: `packages/design-system/src/primitives/PathSpine.tsx`
- Create: `packages/design-system/src/__tests__/status.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1
- Produces:
  - `type StatusWord` — union of the eight fixed strings
  - `PATH_NODES: readonly ['on this device','uploading','saved to library','link ready']`
  - `<StatusChip status={StatusWord} surface?: Surface />`
  - `<PathSpine reached={0|1|2|3|4} state?: 'normal'|'failed'|'offline'|'queued' progress?: number />` — `reached` is how many nodes are complete; `progress` (0–1) fills the bar during `uploading`

- [ ] **Step 1: Write the failing test**

`packages/design-system/src/__tests__/status.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PATH_NODES } from '../status';
import { StatusChip } from '../primitives/StatusChip';
import { PathSpine } from '../primitives/PathSpine';

describe('status vocabulary', () => {
  it('fixes the four path nodes in order', () => {
    expect(PATH_NODES).toEqual(['on this device', 'uploading', 'saved to library', 'link ready']);
  });
});

describe('StatusChip', () => {
  it('renders the status word as text, never colour alone', () => {
    render(<StatusChip status="needs a reply" />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('uses coral only for the live and needs-a-reply statuses', () => {
    const { rerender } = render(<StatusChip status="recording" />);
    expect(screen.getByTestId('chip')).toHaveStyle({ background: 'var(--sr-coral-text)' });

    rerender(<StatusChip status="shared" />);
    expect(screen.getByTestId('chip')).not.toHaveStyle({ background: 'var(--sr-coral-text)' });
  });
});

describe('PathSpine', () => {
  it('names all four nodes', () => {
    render(<PathSpine reached={1} />);
    for (const node of PATH_NODES) {
      expect(screen.getByText(new RegExp(node))).toBeInTheDocument();
    }
  });

  it('marks reached nodes complete and leaves the rest hollow', () => {
    render(<PathSpine reached={2} />);
    expect(screen.getAllByTestId('node-complete')).toHaveLength(2);
    expect(screen.getAllByTestId('node-pending')).toHaveLength(2);
  });

  it('turns the bar coral when the path has failed', () => {
    render(<PathSpine reached={1} state="failed" />);
    expect(screen.getByTestId('spine-fill')).toHaveStyle({ background: 'var(--sr-coral-text)' });
  });

  it('uses no error colouring when merely offline', () => {
    render(<PathSpine reached={1} state="offline" />);
    expect(screen.getByTestId('spine-fill')).not.toHaveStyle({ background: 'var(--sr-coral-text)' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- status
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement status.ts**

```ts
/** The fixed vocabulary. These strings are never paraphrased anywhere in the product. */
export const STATUS_WORDS = [
  'on this device',
  'uploading',
  'saved to library',
  'link ready',
  'processing',
  'private',
  'shared',
  'needs a reply',
  'recording',
] as const;

export type StatusWord = (typeof STATUS_WORDS)[number];

/** The path spine, always in this order. Reused as progress bar and library status line. */
export const PATH_NODES = [
  'on this device',
  'uploading',
  'saved to library',
  'link ready',
] as const satisfies readonly StatusWord[];

export type PathState = 'normal' | 'failed' | 'offline' | 'queued';
```

- [ ] **Step 4: Implement StatusChip.tsx**

```tsx
import type { StatusWord } from '../status';
import type { Surface } from './Button';

/** Only these two statuses may wear coral. */
const CORAL: ReadonlySet<StatusWord> = new Set(['recording', 'needs a reply']);

export interface StatusChipProps {
  status: StatusWord;
  surface?: Surface;
}

export function StatusChip({ status, surface = 'light' }: StatusChipProps) {
  const coral = CORAL.has(status);
  const cyan = status === 'shared' || status === 'link ready';

  return (
    <span
      data-testid="chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 8px',
        fontFamily: 'var(--sr-font-mono)',
        fontSize: 10,
        background: coral ? 'var(--sr-coral-text)' : 'transparent',
        color: coral
          ? 'var(--sr-coral-text-fg)'
          : cyan
            ? surface === 'dark' ? 'var(--sr-cyan)' : 'var(--sr-cyan-on-light)'
            : surface === 'dark' ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-faint-on-light)',
        border: coral
          ? 'none'
          : `1px solid ${surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)'}`,
      }}
    >
      {status === 'recording' && (
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
      )}
      {status}
    </span>
  );
}
```

- [ ] **Step 5: Implement PathSpine.tsx**

```tsx
import { PATH_NODES, type PathState } from '../status';

export interface PathSpineProps {
  /** How many nodes are complete, 0–4. */
  reached: 0 | 1 | 2 | 3 | 4;
  state?: PathState;
  /** 0–1, used while uploading to fill between nodes. */
  progress?: number;
}

export function PathSpine({ reached, state = 'normal', progress }: PathSpineProps) {
  const fraction = progress ?? reached / PATH_NODES.length;
  const fill =
    state === 'failed'
      ? 'var(--sr-coral-text)'
      : state === 'offline' || state === 'queued'
        ? 'var(--sr-text-faint-on-light)'
        : 'var(--sr-green)';

  return (
    <div>
      <div style={{ position: 'relative', height: 2, background: 'var(--sr-border-light-soft)' }}>
        <span
          data-testid="spine-fill"
          style={{ position: 'absolute', inset: '0 auto 0 0', width: `${fraction * 100}%`, background: fill }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PATH_NODES.length}, 1fr)`,
          marginTop: 8,
          fontFamily: 'var(--sr-font-mono)',
          fontSize: 10,
        }}
      >
        {PATH_NODES.map((node, i) => {
          const done = i < reached;
          return (
            <span
              key={node}
              style={{ color: done ? 'var(--sr-text-primary-on-light)' : 'var(--sr-text-faint-on-light)' }}
            >
              <span
                data-testid={done ? 'node-complete' : 'node-pending'}
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  marginRight: 6,
                  background: done ? fill : 'transparent',
                  border: done ? 'none' : '1px solid var(--sr-text-faint-on-light)',
                }}
              />
              {node}
              {done ? ' ✓' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test --workspace=packages/design-system -- status
```

Expected: PASS, 6 assertions.

- [ ] **Step 7: Commit**

```bash
git add packages/design-system/src/status.ts packages/design-system/src/primitives/StatusChip.tsx packages/design-system/src/primitives/PathSpine.tsx packages/design-system/src/__tests__/status.test.tsx
git commit -m "feat(design-system): add fixed status vocabulary, StatusChip and PathSpine"
```

---

## Task 7: SegmentedControl, Switch, Mono, Field, and the barrel

**Files:**
- Create: `packages/design-system/src/primitives/SegmentedControl.tsx`
- Create: `packages/design-system/src/primitives/Switch.tsx`
- Create: `packages/design-system/src/primitives/Mono.tsx`
- Create: `packages/design-system/src/primitives/Field.tsx`
- Create: `packages/design-system/src/motion.ts`
- Create: `packages/design-system/src/index.ts`
- Create: `packages/design-system/src/__tests__/controls.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1
- Produces:
  - `<SegmentedControl options={{value,label,icon?}[]} value onChange surface? size? label />` with `role="radiogroup"`
  - `<Switch checked onChange label surface? />` with `role="switch"`
  - `<Mono>{children}</Mono>` — Azeret Mono with `font-variant-numeric: tabular-nums`
  - `<Field />` extending `InputHTMLAttributes<HTMLInputElement>`, cyan focus ring
  - `motion` — `{ fast: 120, mid: 180, slow: 220, ease: 'cubic-bezier(.2,.8,.2,1)' }`
  - `src/index.ts` re-exporting everything above plus Tasks 2–6

- [ ] **Step 1: Write the failing test**

`packages/design-system/src/__tests__/controls.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { Switch } from '../primitives/Switch';
import { Mono } from '../primitives/Mono';

const SOURCES = [
  { value: 'tab', label: 'This tab' },
  { value: 'window', label: 'Window' },
  { value: 'screen', label: 'Screen' },
];

describe('SegmentedControl', () => {
  it('exposes radiogroup semantics with a label', () => {
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Recording source' })).toBeInTheDocument();
  });

  it('marks exactly one option checked', () => {
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={() => {}} />);
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Recording source" options={SOURCES} value="tab" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Window' }));
    expect(onChange).toHaveBeenCalledWith('window');
  });
});

describe('Switch', () => {
  it('exposes switch semantics and toggles', async () => {
    const onChange = vi.fn();
    render(<Switch label="Microphone" checked={false} onChange={onChange} />);
    const el = screen.getByRole('switch', { name: 'Microphone' });
    expect(el).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(el);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Mono', () => {
  it('uses tabular numerals so timers do not jitter', () => {
    render(<Mono>02:14</Mono>);
    expect(screen.getByText('02:14')).toHaveStyle({ fontVariantNumeric: 'tabular-nums' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test --workspace=packages/design-system -- controls
```

Expected: FAIL — modules not found. (`@testing-library/user-event` was installed in Task 1.)

- [ ] **Step 3: Implement SegmentedControl.tsx**

```tsx
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/types';
import type { ControlHeight, Surface } from './Button';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: IconifyIcon;
}

export interface SegmentedControlProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  surface?: Surface;
  size?: ControlHeight;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  surface = 'light',
  size = 34,
}: SegmentedControlProps) {
  const border = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';
  const idle = surface === 'dark' ? 'var(--sr-text-secondary-on-dark)' : 'var(--sr-text-muted-on-light)';

  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', border: `1px solid ${border}` }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              height: size,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${border}`,
              background: on ? 'var(--sr-cyan)' : 'transparent',
              color: on ? 'var(--sr-cyan-fg)' : idle,
              fontFamily: 'var(--sr-font-ui)',
              fontSize: 11.5,
              fontWeight: on ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {o.icon && <Icon icon={o.icon} width={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement Switch.tsx, Mono.tsx, Field.tsx and motion.ts**

`Switch.tsx`:

```tsx
import type { Surface } from './Button';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  surface?: Surface;
}

export function Switch({ label, checked, onChange, surface = 'light' }: SwitchProps) {
  const off = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 26,
        height: 15,
        flex: 'none',
        position: 'relative',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: checked ? 'var(--sr-cyan)' : off,
        transition: `background var(--sr-dur-fast) var(--sr-ease)`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 13 : 2,
          width: 11,
          height: 11,
          background: checked ? 'var(--sr-cyan-fg)' : 'var(--sr-text-faint-on-dark)',
          transition: `left var(--sr-dur-fast) var(--sr-ease)`,
        }}
      />
    </button>
  );
}
```

`Mono.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

export interface MonoProps {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}

export function Mono({ children, size = 10.5, style }: MonoProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--sr-font-mono)',
        fontSize: size,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
```

`Field.tsx`:

```tsx
import { useState, type InputHTMLAttributes } from 'react';
import type { Surface } from './Button';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  surface?: Surface;
}

export function Field({ surface = 'light', style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const border = surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)';

  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      style={{
        height: 'var(--sr-h-sm)',
        padding: '0 12px',
        fontFamily: 'var(--sr-font-ui)',
        fontSize: 13,
        borderRadius: 'var(--sr-radius-control)',
        background: surface === 'dark' ? 'var(--sr-surface-panel-dark)' : 'var(--sr-surface-paper)',
        color: surface === 'dark' ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-primary-on-light)',
        border: `1px solid ${focused ? 'var(--sr-cyan)' : border}`,
        boxShadow: focused ? 'var(--sr-focus-ring)' : 'none',
        outline: 'none',
        ...style,
      }}
    />
  );
}
```

`motion.ts`:

```ts
export const motion = Object.freeze({
  fast: 120,
  mid: 180,
  slow: 220,
  ease: 'cubic-bezier(.2,.8,.2,1)',
});

/** The signature gesture. Used at exactly three moments: countdown, capture completion, link creation. */
export const CORNER_STRIKE_KEYFRAMES = `
@keyframes sr-corner-strike {
  from { opacity: 0; transform: scale(1.25); }
  to   { opacity: 1; transform: scale(1); }
}`;
```

- [ ] **Step 5: Write the barrel**

`packages/design-system/src/index.ts`:

```ts
export { Button, type ButtonProps, type ButtonVariant, type ControlHeight, type Surface } from './primitives/Button';
export { IconButton, type IconButtonProps } from './primitives/IconButton';
export { Frame, type FrameProps, type FrameTreatment } from './primitives/Frame';
export { Logo, type LogoProps } from './primitives/Logo';
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './primitives/SegmentedControl';
export { Switch, type SwitchProps } from './primitives/Switch';
export { Mono, type MonoProps } from './primitives/Mono';
export { Field, type FieldProps } from './primitives/Field';
export { StatusChip, type StatusChipProps } from './primitives/StatusChip';
export { PathSpine, type PathSpineProps } from './primitives/PathSpine';
export { icons, type IconName } from './icons';
export { motion, CORNER_STRIKE_KEYFRAMES } from './motion';
export { STATUS_WORDS, PATH_NODES, type StatusWord, type PathState } from './status';
```

- [ ] **Step 6: Run the full suite**

```bash
npm test --workspace=packages/design-system
```

Expected: PASS — every test from Tasks 1–7.

- [ ] **Step 7: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(design-system): add form controls, motion constants and public barrel"
```

---

## Task 8: Adopt the tokens in apps/web

**Files:**
- Modify: `apps/web/package.json`
- Rewrite: `apps/web/src/index.css`
- Delete: `apps/web/tailwind.config.js`
- Modify: `apps/web/index.html`
- Rewrite: `apps/web/src/components/Logo.tsx`

**Interfaces:**
- Consumes: `@snaprec/design-system` tokens, fonts and `Logo` from Tasks 1–3
- Produces: Tailwind utilities generated from `--sr-*`; `apps/web`'s `Logo` re-exports the design-system mark, preserving its existing props so the 15 call sites keep compiling

- [ ] **Step 1: Add the workspace dependency**

In `apps/web/package.json`, add to `dependencies`:

```json
"@snaprec/design-system": "*",
```

Then:

```bash
npm install
```

- [ ] **Step 2: Rewrite index.css**

`apps/web/src/index.css` — note `@theme inline`, which makes Tailwind read the custom properties rather than copy their values:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@import "@snaprec/design-system/fonts.css";
@import "@snaprec/design-system/tokens.css";

/* Tailwind utilities generate FROM the tokens. Do not restate hex here. */
@theme inline {
  --color-carbon: var(--sr-surface-carbon);
  --color-well: var(--sr-surface-well);
  --color-paper: var(--sr-surface-paper);
  --color-panel: var(--sr-surface-panel-light);
  --color-line: var(--sr-border-light);
  --color-line-soft: var(--sr-border-light-soft);
  --color-ink: var(--sr-text-primary-on-light);
  --color-ink-2: var(--sr-text-secondary-on-light);
  --color-ink-3: var(--sr-text-muted-on-light);
  --color-ink-4: var(--sr-text-faint-on-light);
  --color-cyan: var(--sr-cyan);
  --color-cyan-ink: var(--sr-cyan-on-light);
  --color-cyan-tint: var(--sr-cyan-tint);
  --color-coral: var(--sr-coral-text);
  --color-coral-mark: var(--sr-coral-mark);
  --color-green: var(--sr-green);

  --font-ui: var(--sr-font-ui);
  --font-mono: var(--sr-font-mono);

  --radius-none: var(--sr-radius-none);
  --radius-control: var(--sr-radius-control);
}

@layer base {
  body {
    font-family: var(--sr-font-ui);
    background: var(--sr-surface-paper);
    color: var(--sr-text-primary-on-light);
  }
}

/* Material Symbols is still loaded for surfaces not yet converted (P3/P5).
   Remove this rule once the last Material Symbols call site is gone. */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.canvas-container-stable {
  contain: layout;
}
```

- [ ] **Step 3: Delete the dead Tailwind config**

It is not loaded — `index.css` has no `@config` directive — and its stale `primary: #7b25f4` invites confusion.

```bash
git rm apps/web/tailwind.config.js
```

- [ ] **Step 4: Strip remote font loading from index.html**

In `apps/web/index.html`, delete these four blocks: the two `preconnect` links to Google Fonts, the Inter `preload`, and the Inter stylesheet `preload`+`noscript` pair. **Keep** the Material Symbols pair and the AdSense script.

Change the favicon line from:

```html
<link rel="icon" type="image/png" href="/logo.png" />
```

to:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 5: Create the favicon**

`apps/web/public/favicon.svg` — the same geometry as the `Logo` primitive, with literal hex because a favicon has no access to CSS variables:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">
  <rect width="14" height="14" fill="#0C1011"/>
  <path d="M2 7V2h5" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <path d="M12 7v5H7" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <rect x="5.5" y="5.5" width="3" height="3" fill="#FF3B2E"/>
</svg>
```

- [ ] **Step 6: Rewrite the web Logo wrapper**

`apps/web/src/components/Logo.tsx` keeps its existing props so none of its call sites change:

```tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo as Mark } from '@snaprec/design-system';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    /** When true (default), logo links to home. Set false for plain display. */
    clickable?: boolean;
}

const markSize = { sm: 16, md: 20, lg: 26 } as const;

export const Logo: React.FC<LogoProps> = ({
    size = 'md',
    showText = true,
    className = '',
    clickable = true,
}) => {
    const content = <Mark size={markSize[size]} withWordmark={showText} />;
    const wrapperClass = `flex items-center gap-2 ${className}`;

    return clickable ? (
        <NavLink to="/" className={wrapperClass} aria-label="SnapRec home">{content}</NavLink>
    ) : (
        <span className={wrapperClass}>{content}</span>
    );
};

export default Logo;
```

- [ ] **Step 7: Verify the build**

```bash
npm run build --workspace=apps/web
```

Expected: PASS. TypeScript may flag call sites that passed props the old wrapper silently ignored — fix those call sites, do not widen the interface.

- [ ] **Step 8: Commit**

```bash
git add apps/web package-lock.json
git rm --cached apps/web/tailwind.config.js 2>/dev/null || true
git commit -m "feat(web): adopt plate tokens, self-hosted fonts and new brand mark"
```

---

## Task 9: Remove the unintended dark mode

**Files:**
- Modify: 21 files under `apps/web/src` containing `dark:` utilities
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: nothing
- Produces: no `dark:` utility anywhere in `apps/web`; management surfaces render light unconditionally

Context: `dark:` compiled against Tailwind v4's default `prefers-color-scheme` variant, so OS-dark visitors have been seeing an undesigned dark UI. Spec decision D4 removes it; dark returns only inside Technical workspaces in P4, via explicit tokens.

- [ ] **Step 1: List the affected files**

```bash
cd apps/web && grep -rl "dark:" src --include="*.tsx" | sort
```

Expected: 21 files. Record the list — it is the checklist for Step 2.

- [ ] **Step 2: Strip the variants**

For each file, delete every `dark:*` class from `className` strings, leaving the light-mode classes untouched. Work file by file and re-read each edit: `dark:` classes are frequently interleaved mid-string, e.g.

```tsx
className="bg-white dark:bg-[#1c142b] text-slate-900 dark:text-white"
```

becomes

```tsx
className="bg-white text-slate-900"
```

Do not "simplify" the remaining classes; that is a different change with a different review.

- [ ] **Step 3: Remove the inert class attribute**

In `apps/web/index.html`, change `<html lang="en" class="light">` to `<html lang="en">`. The class never did anything — no `.dark` variant was ever generated — but leaving it implies a theming system that does not exist.

- [ ] **Step 4: Verify no dark variants remain**

```bash
cd apps/web && grep -rn "dark:" src --include="*.tsx" | wc -l
```

Expected: `0`.

- [ ] **Step 5: Verify the build and the compiled CSS**

```bash
npm run build --workspace=apps/web
grep -c "prefers-color-scheme" dist/assets/*.css
```

Expected: build passes; the `grep` returns `0`, proving the dark media query is gone from the bundle.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/index.html
git commit -m "fix(web): remove unintended prefers-color-scheme dark mode"
```

---

## Task 10: Regenerate the extension icons

**Files:**
- Create: `packages/design-system/scripts/render-icons.mjs`
- Modify: `apps/extension/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

**Interfaces:**
- Consumes: the mark geometry from Task 3
- Produces: four PNGs matching the manifest's declared sizes

Uses puppeteer, already a devDependency of `apps/web`, so no new tooling is introduced.

- [ ] **Step 1: Write the rasteriser**

`packages/design-system/scripts/render-icons.mjs`:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../../apps/extension/icons');
const SIZES = [16, 32, 48, 128];

/** Carbon tile, cyan brackets, coral capture dot — the mark from primitives/Logo.tsx. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">
  <rect width="14" height="14" fill="#0C1011"/>
  <path d="M2 7V2h5" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <path d="M12 7v5H7" fill="none" stroke="#06A6C0" stroke-width="2"/>
  <rect x="5.5" y="5.5" width="3" height="3" fill="#FF3B2E"/>
</svg>`;

const browser = await puppeteer.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<html><body style="margin:0">
       <div style="width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>
     </body></html>`
  );
  const buf = await page.screenshot({ omitBackground: false, type: 'png' });
  writeFileSync(resolve(OUT, `icon${size}.png`), buf);
  console.log(`wrote icon${size}.png`);
}

await browser.close();
```

- [ ] **Step 2: Run it**

```bash
node packages/design-system/scripts/render-icons.mjs
```

Expected: four `wrote iconNN.png` lines.

- [ ] **Step 3: Verify the output dimensions**

```bash
cd apps/extension/icons && file icon16.png icon32.png icon48.png icon128.png
```

Expected: each reports its matching `NN x NN` size.

- [ ] **Step 4: Confirm the extension still loads**

Load `apps/extension` unpacked in Chrome. The toolbar icon shows the new carbon/cyan mark. (The popup is still the old purple UI — that is P1's job.)

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/scripts/render-icons.mjs apps/extension/icons
git commit -m "feat(extension): regenerate toolbar icons from the plate brand mark"
```

---

## Task 11: Document the foundation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above
- Produces: repository documentation matching reality

- [ ] **Step 1: Update CLAUDE.md**

Three edits:

1. In **Project Overview**, add `packages/design-system` to the monorepo list and note that `packages/` is no longer empty.
2. Add a **Design system** subsection under Architecture:

```markdown
### Design system (`packages/design-system`)

`src/tokens.css` is the single source of truth for the plate visual language — every colour, control height, radius and duration. Primitives read `var(--sr-*)`; a hex literal in a `.tsx` file is a bug.

`apps/web/src/index.css` imports the tokens and re-exports them through `@theme inline`, so Tailwind utilities generate from the same custom properties rather than a parallel copy. There is no `tailwind.config.js` — Tailwind v4 would only load one via an `@config` directive, and the old file was silently dead.

Fonts and icons are bundled, never CDN-loaded: P1 ships these primitives into an MV3 extension page, where remote scripts and styles are CSP-blocked.

Coral (`#D8331F` text-bearing, `#FF3B2E` marks) is reserved for live capture and needs-a-response. `StatusChip` accepts only the fixed status vocabulary and `Button`'s `capture` variant is the only coral-filled control — both exist to keep that rule enforceable.

Run `npm test --workspace=packages/design-system`. The contrast suite parses `tokens.css` and fails the build if any text pair drops below WCAG AA.
```

3. In the **Docker/deployment** notes, record that the root `Dockerfile` must copy every workspace `package.json` — including `packages/design-system` — in **both** stages, or `npm ci --workspace=apps/server` fails.

- [ ] **Step 2: Full verification sweep**

```bash
npm test --workspace=packages/design-system
npm run build --workspace=apps/web
npm run build --workspace=apps/server
docker build -t snaprec-server-check .
```

Expected: all four pass.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the design-system package and its constraints"
```

---

## Done when

- `npm test --workspace=packages/design-system` passes, including the contrast gate
- `npm run build` passes for both `apps/web` and `apps/server`
- `docker build .` succeeds
- `grep -rn "dark:" apps/web/src --include="*.tsx"` returns nothing
- `grep -c "prefers-color-scheme" apps/web/dist/assets/*.css` returns `0`
- The web app renders in plate colours with Schibsted Grotesk, no Google Fonts request in the network tab
- The extension toolbar shows the new mark

**Not** done in P0, by design: the extension popup, in-page bar, completion route and share view. Those are P1 and P2. Dashboard and marketing surfaces will look transitional — new tokens, old layouts — which is expected and accepted in spec §2.
