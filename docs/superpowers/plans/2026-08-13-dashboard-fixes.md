# Dashboard Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the false "extension not installed" report, replace that card with a Patreon support card when the extension is present, make every capture card the same height, give the avatar a working account menu with sign-out, and disable magic-link sign-in.

**Architecture:** Six independent changes, each its own task and commit. Task 1 adds a `'checking'` state to the extension-status hook and fixes the env var that broke detection. Task 2 reuses that state to render a Patreon card on `connected`. Task 3 is a two-line CSS containment fix in the design system and `CapturePreview`. Task 4 adds an `AccountMenu` component owned by `AppShell`, following the popover pattern `AppShell` already uses for `CapturePopover`, with a `BottomSheet` variant on mobile. Tasks 5 and 6 are copy/wiring corrections in Settings and the login panel.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + React Testing Library + jsdom (existing `apps/web` stack). No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-dashboard-fixes-design.md`. Real account deletion is a **separate** plan and is explicitly not implemented here.
- All commands run from `apps/web/` unless stated. `npx vitest run` from the repo root uses the wrong config and fails with `document is not defined`.
- Colours come from `var(--sr-*)` tokens. A hex literal in a `.tsx` file is a bug. The one exception already in the codebase is `#fff`, which existing code uses freely.
- Coral (`--sr-coral-*`) is reserved for live capture and needs-a-response. Do not use it for the Patreon card or the account menu. It is legitimate for a destructive confirm, which this plan does not build.
- Management surfaces are light-only. Do not add `dark:` utilities.
- `TopBar.tsx` and `AppShell.tsx` style with inline objects and `@iconify/react`, not the design-system `Button`. Match that. Do not import the existing `components/UserMenu.tsx` — it is Tailwind/`material-symbols` styled, renders its own avatar trigger, and has a weaker dismiss; it stays in use by the Video Editor only.
- Patreon URL is exactly `https://www.patreon.com/cw/SnapRec`, opened with `target="_blank" rel="noopener"`.
- Extension ID is exactly `lgafjgnifbjeafallnkkfpljgbilfajg`.
- Do not run `npm run lint` as a gate — ESLint 9.39.2 crashes repo-wide with `TypeError: Cannot set properties of undefined (setting 'defaultMeta')` inside `@eslint/eslintrc`/ajv. This is pre-existing and unrelated. Use `npx tsc -b` for static verification.

---

### Task 1: Add a `checking` state and fix the extension ID

**Files:**
- Modify: `apps/web/src/hooks/useExtensionStatus.ts`
- Modify: `apps/web/.env` (create the key; the file exists but has no `VITE_EXTENSION_ID`)
- Modify: `apps/web/.env.example:16`
- Modify: `apps/web/src/pages/Home/ExtensionNotice.tsx:16`
- Modify: `apps/web/src/components/AppShell.tsx:41-46`
- Modify: `apps/web/src/pages/Settings.tsx:20`
- Modify: `apps/web/src/components/CapturePopover.tsx:95`
- Test: `apps/web/src/hooks/__tests__/useExtensionStatus.test.ts` (exists, extend)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `ExtensionStatus` gains the member `'checking'`, so the union is `'checking' | 'connected' | 'notInstalled' | 'notResponding' | 'unsupported'`. Task 2 renders on `'connected'` and must render nothing for `'checking'`.

- [ ] **Step 1: Write the failing tests**

Append these cases to `apps/web/src/hooks/__tests__/useExtensionStatus.test.ts`, inside the existing top-level `describe` (keep every existing case untouched):

```ts
  it('starts in checking, not in a failure state', async () => {
    // A hook that initialises to notResponding tells the user the extension is
    // broken before it has asked. That was the flash this state exists to stop.
    const { result } = renderHook(() => useExtensionStatus());
    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).not.toBe('checking'));
  });

  it('clears its timeout when the ping answers first', async () => {
    vi.useFakeTimers();
    try {
      const ping = () => Promise.resolve({ version: '1.3.3' });
      await detectExtension({ isChromium: true, ping, timeoutMs: 1200 });
      // A pending timer per call leaks, and in tests it fires after teardown.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
```

Add `renderHook` and `waitFor` to the `@testing-library/react` import and `useExtensionStatus` to the import from `../useExtensionStatus`. The file currently imports only `detectExtension`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useExtensionStatus.test.ts`
Expected: FAIL — the first case gets `'notResponding'` instead of `'checking'`; the second reports a timer count of 1.

- [ ] **Step 3: Add `checking` to the union and fix the timer**

In `apps/web/src/hooks/useExtensionStatus.ts`, replace the type and its doc comment:

```ts
/** The five cases from scene H5, plus the one the prototype did not have.
 *
 * The distinction that matters to the user is between "install it" and "it is
 * installed but something is wrong" — those take different actions, so they are
 * different states rather than one error.
 *
 * `checking` exists because the honest answer before the ping resolves is "we
 * do not know yet". Initialising to a failure state made every consumer assert
 * a problem for up to the full timeout, and then take it back. */
export type ExtensionStatus =
  | 'checking' | 'connected' | 'notInstalled' | 'notResponding' | 'unsupported';
```

Replace the body of `detectExtension` so the timer is cleared on every exit:

```ts
export async function detectExtension(
  { isChromium, ping, timeoutMs = 1200 }: ExtensionDetectDeps,
): Promise<ExtensionState> {
  if (!isChromium) return { status: 'unsupported' };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const result = await Promise.race([ping(), timeout]);
    if (result === 'timeout') return { status: 'notResponding' };
    if (result === null) return { status: 'notInstalled' };
    return { status: 'connected', version: result.version };
  } catch {
    return { status: 'notResponding' };
  } finally {
    clearTimeout(timer);
  }
}
```

Change the initial state at the bottom of the file:

```ts
  const [state, setState] = useState<ExtensionState>({ status: 'checking' });
```

- [ ] **Step 4: Set the extension ID in both env files**

In `apps/web/.env.example`, replace line 16 (`VITE_EXTENSION_ID=`) with:

```
VITE_EXTENSION_ID=lgafjgnifbjeafallnkkfpljgbilfajg
```

`apps/web/.env` has no such key at all — append the same line to it.

This is the ID from the store URL already hardcoded in `apps/web/src/components/AddToChromeButton.tsx:9`. It is a public identifier, not a secret, which is why it belongs in `.env.example` with a real value rather than as a blank placeholder.

- [ ] **Step 5: Teach every consumer that `checking` is not a failure**

`apps/web/src/pages/Home/ExtensionNotice.tsx:16` — replace:

```tsx
  if (status === 'connected') return null;
```

with:

```tsx
  // Nothing is known yet, so say nothing. Task 2 gives `connected` its own card.
  if (status === 'checking' || status === 'connected') return null;
```

`apps/web/src/components/AppShell.tsx:41-46` — add the member (the map is keyed by the full union, so TypeScript fails to compile without it):

```tsx
const EXTENSION_TONE = {
  checking: 'unknown',
  connected: 'on',
  notInstalled: 'off',
  notResponding: 'off',
  unsupported: 'unknown',
} as const;
```

`apps/web/src/pages/Settings.tsx:20` — replace:

```tsx
  const extensionAbsent = status !== 'connected';
```

with:

```tsx
  // Disabling fields while the ping is in flight would grey them out and then
  // re-enable them a second later.
  const extensionAbsent = status !== 'connected' && status !== 'checking';
```

`apps/web/src/components/CapturePopover.tsx:95` — replace:

```tsx
        {status === 'connected' ? `Extension ${version} connected · ` : 'Extension not detected · '}
```

with:

```tsx
        {status === 'connected' ? `Extension ${version} connected · `
          : status === 'checking' ? 'Checking for the extension · '
          : 'Extension not detected · '}
```

`apps/web/src/pages/Home/NewUser.tsx:20` is deliberately left unchanged. Its `installed` flag only chooses between two calls to action, and "Add SnapRec to Chrome" is the right default for a zero-recording account while detection is in flight — it asserts nothing about the current state.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useExtensionStatus.test.ts`
Expected: PASS — all cases including the two new ones.

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: both clean. `tsc` is the real gate here — the `EXTENSION_TONE` map and any `switch` over `ExtensionStatus` will fail to compile if a consumer was missed, which is the point of adding the member to the union rather than widening to `string`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/useExtensionStatus.ts apps/web/src/hooks/__tests__/useExtensionStatus.test.ts apps/web/.env.example apps/web/src/pages/Home/ExtensionNotice.tsx apps/web/src/components/AppShell.tsx apps/web/src/pages/Settings.tsx apps/web/src/components/CapturePopover.tsx
git commit -m "fix(web): send the extension ping and stop reporting failure before it answers"
```

`apps/web/.env` is gitignored — do not try to add it, and do not force it.

**After committing, tell the user this, because the code fix alone does not fix production:** Vite inlines `VITE_*` at build time, so `VITE_EXTENSION_ID` must also be added to the **Cloudflare Pages build environment variables**, or the deployed site keeps reporting "not installed".

---

### Task 2: The "Keep SnapRec free" card

**Files:**
- Create: `apps/web/src/lib/patreon.ts`
- Modify: `apps/web/src/components/TopBar.tsx` (remove its local `PATREON_URL`, import the shared one)
- Modify: `apps/web/src/pages/Home/ExtensionNotice.tsx`
- Test: `apps/web/src/pages/Home/__tests__/ExtensionNotice.test.tsx` (new)

**Interfaces:**
- Consumes: `ExtensionStatus` including `'checking'` (Task 1).
- Produces: `export const PATREON_URL = 'https://www.patreon.com/cw/SnapRec'` from `apps/web/src/lib/patreon.ts`. Two call sites need it, so it stops being a `TopBar` local.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/pages/Home/__tests__/ExtensionNotice.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtensionNotice } from '../ExtensionNotice';

describe('ExtensionNotice', () => {
  it('asks for support once the extension is connected', () => {
    render(<ExtensionNotice status="connected" version="1.3.3" />);
    const link = screen.getByRole('link', { name: /Patreon/i });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('says nothing at all while detection is still in flight', () => {
    const { container } = render(<ExtensionNotice status="checking" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still asks the user to install when the extension is absent', () => {
    render(<ExtensionNotice status="notInstalled" />);
    expect(screen.getByText('Extension not installed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Patreon/i })).toBeNull();
  });

  it('does not ask for support when something is wrong', () => {
    render(<ExtensionNotice status="notResponding" />);
    expect(screen.queryByRole('link', { name: /Patreon/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/Home/__tests__/ExtensionNotice.test.tsx`
Expected: FAIL — the first case finds no Patreon link, because `connected` currently returns `null`.

- [ ] **Step 3: Extract the shared constant**

Create `apps/web/src/lib/patreon.ts`:

```ts
/** Hosting and egress are the running cost of a free product, and this is the
 * one place users can offset it. A static public URL, so it is a constant
 * rather than config — there is no per-environment variant. */
export const PATREON_URL = 'https://www.patreon.com/cw/SnapRec';
```

In `apps/web/src/components/TopBar.tsx`, delete the line:

```tsx
const PATREON_URL = 'https://www.patreon.com/cw/SnapRec';
```

and add to its imports:

```tsx
import { PATREON_URL } from '../lib/patreon';
```

Everything else in `TopBar.tsx` — `PATREON_PHRASES`, `PATREON_LABEL_WIDTH`, `PatreonLabel`, and the `<a>` — is unchanged.

- [ ] **Step 4: Render the support card on `connected`**

In `apps/web/src/pages/Home/ExtensionNotice.tsx`, add the import:

```tsx
import { PATREON_URL } from '../../lib/patreon';
```

Replace the early return added in Task 1:

```tsx
  if (status === 'checking' || status === 'connected') return null;
```

with:

```tsx
  if (status === 'checking') return null;
  if (status === 'connected') return <SupportCard />;
```

Add this component at the bottom of the file, above the shared style constants:

```tsx
/** The slot the install prompt used to own. Once the extension is in place
 * there is nothing to instruct, so the space asks for support instead — the
 * quiet version of the ask, not a coral call to action. */
function SupportCard() {
  return (
    <section style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: '14px 16px',
    }}>
      <h2 style={h2}>Help keep SnapRec free</h2>
      <p style={body}>
        Recording, hosting and sharing all cost something to run. There is no
        paid tier and no watermark — a few pounds a month from people who use it
        is what keeps it that way.
      </p>
      <a href={PATREON_URL} target="_blank" rel="noopener" style={primaryLink}>
        Support us on Patreon
      </a>
    </section>
  );
}
```

`h2`, `body`, and `primaryLink` are the existing `as const` style objects at the bottom of the file — reuse them rather than declaring new ones, so the card matches the three install/error cards it sits in for.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/Home/__tests__/ExtensionNotice.test.tsx`
Expected: PASS — all 4 cases.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: both clean. `src/components/__tests__/TopBar.test.tsx` must still pass — the Patreon link's `href` assertion there now resolves through the shared constant, so a wrong extraction shows up immediately.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/patreon.ts apps/web/src/components/TopBar.tsx apps/web/src/pages/Home/ExtensionNotice.tsx apps/web/src/pages/Home/__tests__/ExtensionNotice.test.tsx
git commit -m "feat(web): ask for Patreon support once the extension is connected"
```

---

### Task 3: Uniform capture card geometry

**Files:**
- Modify: `apps/web/src/components/CapturePreview.tsx:136`
- Modify: `packages/design-system/src/primitives/CapturePlate.tsx:57-60`
- Test: `apps/web/src/components/__tests__/CapturePreview.test.tsx` (exists, extend)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no API change. `CapturePlate`'s props and `CapturePreview`'s props are untouched; only styles change.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/__tests__/CapturePreview.test.tsx` as a new top-level `describe`. The file's `rec()` helper at line 7 already takes a `Partial<Recording>` override and the existing screenshot case calls it as `rec({ type: 'screenshot', fileUrl: 'https://r2/s.png' })` — follow that exactly. No new imports are needed.

```tsx
describe('the geometry a screenshot contributes', () => {
  /** A statically positioned <img> is a flex item's content, and a flex item's
   * automatic minimum size beats `aspect-ratio`. That is what let a tall
   * screenshot stretch its plate and, through the grid's default `stretch`,
   * every other plate in its row. */
  it('takes the screenshot out of flow so it cannot outvote the frame ratio', () => {
    render(<CapturePreview recording={rec({ type: 'screenshot', fileUrl: 'https://r2/s.png' })} />);
    expect(screen.getByTestId('capture-image')).toHaveStyle({ position: 'absolute' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/CapturePreview.test.tsx`
Expected: FAIL — the image has no `position`, since it renders as a bare in-flow `<img style={fill}>`.

- [ ] **Step 3: Take the screenshot out of flow**

In `apps/web/src/components/CapturePreview.tsx`, the screenshot branch currently reads:

```tsx
  if (toCaptureKind(recording) !== 'recording') {
    const still = capturePreviewUrl(recording);
    return still
      ? <img data-testid="capture-image" src={still} alt="" style={fill} />
      : null;
  }
```

Replace the `<img>` style so it matches the treatment the recording branch already gives its own children:

```tsx
  if (toCaptureKind(recording) !== 'recording') {
    const still = capturePreviewUrl(recording);
    // Absolute, like every child of the recording branch: an in-flow image
    // contributes its intrinsic height as the flex item's minimum size, which
    // overrides the frame's `aspect-ratio` for anything taller than 16/9.
    // `CaptureFrame` is the `position: relative` ancestor this resolves against.
    return still
      ? <img
          data-testid="capture-image"
          src={still}
          alt=""
          style={{ ...fill, position: 'absolute', inset: 0 }}
        />
      : null;
  }
```

- [ ] **Step 4: Make the frame clip and stop it growing**

In `packages/design-system/src/primitives/CapturePlate.tsx`, the frame currently reads:

```tsx
      <CaptureFrame
        treatment={def.canPreview ? 'focused' : 'passive'}
        style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9' }}
      >
```

Add containment:

```tsx
      <CaptureFrame
        treatment={def.canPreview ? 'focused' : 'passive'}
        // `minHeight: 0` opts out of the flex automatic minimum size, so
        // `aspect-ratio` is the only thing deciding this box's height.
        // `overflow: hidden` is what lets `object-fit: cover` actually crop.
        style={{
          background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9',
          overflow: 'hidden', minHeight: 0,
        }}
      >
```

Both changes are needed. Step 3 fixes the current offender; Step 4 stops the next in-flow child from reintroducing it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/CapturePreview.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run both test suites**

Run: `npx tsc -b && npx vitest run`
Then, from the repo root: `npm test --workspace=packages/design-system`
Expected: both clean. The design-system suite includes the WCAG contrast check, which these changes do not touch, but `CapturePlate` is design-system code so its own tests must be run.

- [ ] **Step 7: Verify in the browser — this step cannot be skipped**

jsdom performs no layout, so no test in this repo can assert that two cards have equal height. The fix must be confirmed by eye.

Run from the repo root: `npm run web dev`, sign in, and go to Library (grid view) and Home.

Confirm:
- Every card in a row is the same height, with no dead space under any caption.
- A **full-page screenshot** — the worst case, since it is very tall — is centre-cropped into a 16:9 frame rather than stretching its plate.
- A wide/panoramic screenshot is also cropped, not letterboxed.
- Recording cards are unchanged, and hover preview still plays.
- Resize through all four breakpoints; the grid drops to 3 then 2 columns, and below 768px switches to the mobile list. Nothing changes height mid-row.

If you have no full-page screenshot in the account, take one with the extension first — a normal viewport screenshot is close enough to 16:9 that it will not demonstrate the bug.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/CapturePreview.tsx apps/web/src/components/__tests__/CapturePreview.test.tsx packages/design-system/src/primitives/CapturePlate.tsx
git commit -m "fix(web): keep every capture plate at 16:9 regardless of screenshot shape"
```

---

### Task 4: Account menu with sign-out

**Files:**
- Create: `apps/web/src/components/AccountMenu.tsx`
- Modify: `apps/web/src/components/AppShell.tsx` (state, rail `onUserClick` at line 84, `onUserMenu` at line 98, render the menu)
- Modify: `apps/web/src/components/TopBar.tsx` (add `aria-haspopup`/`aria-expanded` to the avatar button)
- Modify: `apps/web/src/components/index.ts` (export `AccountMenu`)
- Test: `apps/web/src/components/__tests__/AccountMenu.test.tsx` (new)

**Interfaces:**
- Consumes: `useAuth()` from `apps/web/src/contexts/AuthContext` — specifically `user` and `signOut` (exact context API at `contexts/AuthContext.tsx:7-17`). `BottomSheet` from `./BottomSheet` (props: `{ label: string; onClose: () => void; children: ReactNode }`). `useBreakpoint()` from `../hooks/useBreakpoint`.
- Produces:

```tsx
export interface AccountMenuProps {
  user: { initials: string; name: string };
  onClose: () => void;
  onNavigate: (to: string) => void;
}
export function AccountMenu(props: AccountMenuProps): JSX.Element;
```

`AppShell` owns the open/closed state and passes `onNavigate` so the menu never imports the router — matching how `CapturePopover` is given `onTroubleshoot` rather than navigating itself.

`TopBarProps` gains one optional prop: `userMenuOpen?: boolean`, used only for `aria-expanded`. `onUserMenu` keeps its existing signature.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/__tests__/AccountMenu.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '../AccountMenu';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const signOut = vi.fn();

vi.mock('../../hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'priya@northlight.co' }, signOut }),
}));

const user = { initials: 'PR', name: 'Priya Raman' };

const mount = (onClose = vi.fn(), onNavigate = vi.fn()) => {
  render(<AccountMenu user={user} onClose={onClose} onNavigate={onNavigate} />);
  return { onClose, onNavigate };
};

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue('desktop');
    signOut.mockClear();
  });

  it('identifies whose account it is', () => {
    mount();
    expect(screen.getByText('Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('priya@northlight.co')).toBeInTheDocument();
  });

  it('signs the user out and closes', async () => {
    const { onClose } = mount();
    await userEvent.click(screen.getByRole('menuitem', { name: /Sign out/i }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to Settings through its callback rather than navigating itself', async () => {
    const { onNavigate } = mount();
    await userEvent.click(screen.getByRole('menuitem', { name: /Settings/i }));
    expect(onNavigate).toHaveBeenCalledWith('/settings');
  });

  it('closes on Escape', async () => {
    const { onClose } = mount();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a click outside itself', async () => {
    const { onClose } = mount();
    await userEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('reaches Projects on mobile, which the bottom bar drops', () => {
    vi.mocked(useBreakpoint).mockReturnValue('mobile');
    mount();
    // MOBILE_NAV filters out projects and settings, and nothing else offers
    // them — so the sheet is the only route to either.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/AccountMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "../AccountMenu"`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/AccountMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { BottomSheet } from './BottomSheet';

export interface AccountMenuProps {
  user: { initials: string; name: string };
  onClose: () => void;
  onNavigate: (to: string) => void;
}

interface Item {
  key: string;
  label: string;
  icon: string;
  to?: string;
}

/** Projects and Settings appear here on mobile because `MOBILE_NAV` drops both
 * from the bottom bar and nothing else offers them. On desktop the rail already
 * has them, so the menu carries Settings only as the conventional place to look
 * for it. */
const DESKTOP_ITEMS: Item[] = [
  { key: 'settings', label: 'Settings', icon: 'ant-design:setting-outlined', to: '/settings' },
];

const MOBILE_ITEMS: Item[] = [
  { key: 'projects', label: 'Projects', icon: 'ant-design:folder-outlined', to: '/projects' },
  ...DESKTOP_ITEMS,
];

export function AccountMenu({ user, onClose, onNavigate }: AccountMenuProps) {
  const { user: account, signOut } = useAuth();
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';

  const items = mobile ? MOBILE_ITEMS : DESKTOP_ITEMS;

  const go = (to: string) => { onNavigate(to); onClose(); };
  const leave = async () => {
    // No navigation: onAuthStateChange clears the session and ProtectedRoute
    // bounces. Pushing a route here would race that.
    await signOut();
    onClose();
  };

  const body = (
    <div role="menu" aria-label="Account" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: mobile ? '4px 18px 12px' : '11px 13px',
        borderBottom: '1px solid var(--sr-border-light-soft)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
        {account?.email && (
          <span style={{ fontSize: 11.5, color: 'var(--sr-text-muted-on-light)' }}>
            {account.email}
          </span>
        )}
      </span>

      {items.map(item => (
        <MenuRow
          key={item.key}
          mobile={mobile}
          icon={item.icon}
          label={item.label}
          onSelect={() => go(item.to!)}
        />
      ))}

      <span aria-hidden="true" style={{
        height: 1, background: 'var(--sr-border-light-soft)', margin: '4px 0',
      }} />

      <MenuRow
        mobile={mobile}
        icon="ant-design:logout-outlined"
        label="Sign out"
        onSelect={leave}
      />
    </div>
  );

  if (mobile) return <BottomSheet label="Account" onClose={onClose}>{body}</BottomSheet>;
  return <Anchored onClose={onClose}>{body}</Anchored>;
}

/** The dismiss contract shared by every popover in the app: Escape, plus a
 * mousedown outside the container. Copied deliberately from FilterPopover
 * rather than from UserMenu, whose listener has no containment check. */
function Anchored({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 22, top: 8, width: 232, zIndex: 40,
        background: 'var(--sr-surface-paper)',
        border: '1px solid var(--sr-border-light)',
        borderRadius: 'var(--sr-radius-control)',
        boxShadow: '0 8px 24px rgba(4,7,8,.13)',
        padding: '4px 0',
      }}
    >
      {children}
    </div>
  );
}

function MenuRow({ mobile, icon, label, onSelect }: {
  mobile: boolean; icon: string; label: string; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      data-min-target={mobile ? '44' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: mobile ? 44 : 32,
        padding: mobile ? '0 18px' : '0 13px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        font: 'inherit', fontSize: 13, textAlign: 'left',
        color: 'var(--sr-text-primary-on-light)',
      }}
    >
      <Icon icon={icon} width={14} style={{ color: 'var(--sr-text-muted-on-light)' }} aria-hidden="true" />
      {label}
    </button>
  );
}
```

Add to `apps/web/src/components/index.ts`:

```ts
export { AccountMenu } from './AccountMenu';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/AccountMenu.test.tsx`
Expected: PASS — all 6 cases.

- [ ] **Step 5: Wire it into AppShell**

In `apps/web/src/components/AppShell.tsx`:

Add the import alongside the others:

```tsx
import { AccountMenu } from './AccountMenu';
```

Add state next to the existing `capturePopover` (line 51):

```tsx
  const [accountMenu, setAccountMenu] = useState(false);
```

Replace the rail's navigate-on-click (line 84):

```tsx
          onUserClick={() => setAccountMenu(open => !open)}
```

Replace `TopBar`'s `onUserMenu` (line 98) and pass the open flag:

```tsx
          onUserMenu={() => setAccountMenu(open => !open)}
          userMenuOpen={accountMenu}
```

Render the menu. On desktop it must sit in the same `position: relative; height: 0` anchor wrapper the capture popover uses, immediately after that block:

```tsx
        {accountMenu && (
          <div style={{ position: 'relative', height: 0 }}>
            <AccountMenu
              user={user}
              onClose={() => setAccountMenu(false)}
              onNavigate={to => navigate(to)}
            />
          </div>
        )}
```

The `BottomSheet` variant is `position: fixed`, so the wrapper is harmless on mobile.

- [ ] **Step 6: Mark the trigger as a menu button**

In `apps/web/src/components/TopBar.tsx`, add to `TopBarProps`:

```tsx
  userMenuOpen?: boolean;
```

Destructure it with a default alongside the other props:

```tsx
  userMenuOpen = false,
```

On the avatar `<button>` (currently `onClick={onUserMenu}`, around line 151), add the two attributes so it stops claiming to be a plain button:

```tsx
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
```

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npx tsc -b && npx vitest run`
Expected: both clean. `src/components/__tests__/AppShell.test.tsx` renders `AppShell` and asserts on the capture popover — it must still pass. Note it does not mock `AuthContext`; if `AccountMenu` is only rendered when `accountMenu` is true, `useAuth` is never called in that suite and no new provider is needed. If a test does fail on a missing provider, that is real information: it means the menu is rendering unconditionally, which is a bug in Step 5, not a reason to wrap the test.

- [ ] **Step 8: Verify in the browser**

Run from the repo root: `npm run web dev`, sign in.

Confirm:
- Clicking the TopBar avatar opens the menu below it, instead of jumping to Settings.
- Clicking the rail avatar opens the same menu.
- Escape closes it; clicking anywhere outside closes it; clicking Settings navigates and closes.
- **Sign out actually returns you to the login page.**
- Below 768px it opens as a bottom sheet with large touch targets, and Projects and Settings are reachable from it — they are unreachable on mobile today.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/AccountMenu.tsx apps/web/src/components/__tests__/AccountMenu.test.tsx apps/web/src/components/AppShell.tsx apps/web/src/components/TopBar.tsx apps/web/src/components/index.ts
git commit -m "feat(web): open an account menu from the avatar and add sign out"
```

---

### Task 5: Stop Settings calling sign-out "delete account"

**Files:**
- Modify: `apps/web/src/pages/Settings/sections.ts:110-118`
- Modify: `apps/web/src/pages/Settings.tsx:117`
- Test: `apps/web/src/pages/__tests__/Settings.test.tsx` (exists, extend)

**Interfaces:**
- Consumes: nothing from other tasks. `SettingField` and `SettingSection` types are at `pages/Settings/sections.ts:9-27` and are unchanged.
- Produces: a new section titled `'Account'` containing a field keyed `'signOut'`. The `'deleteAccount'` field and its `'Delete account'` section are removed here and reinstated by the separate account-deletion plan.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/pages/__tests__/Settings.test.tsx` asserts against the exported `SECTIONS` **data** and never renders the page — it imports only `SECTIONS` from `../Settings/sections`. Keep it that way; do not add rendering here.

Two existing cases assert the old section and must be edited, not appended to.

Edit the section-order case so its last entry is the new title:

```tsx
  it('holds the seven sections in the prototype order', () => {
    expect(SECTIONS.map(s => s.title)).toEqual([
      'Capture defaults',
      'Microphone and camera',
      'Sharing and privacy',
      'Notifications',
      'Storage and downloads',
      'Connected apps',
      'Account',
    ]);
  });
```

Replace the case at lines 38-42 (`puts account deletion last and marks it destructive`) entirely with:

```tsx
  it('offers sign out under its own name, not as account deletion', () => {
    // The old control was labelled "Delete my account and everything in it",
    // marked destructive, and wired to signOut. Whichever the user wanted, they
    // got the other one. Real deletion lands separately; until then nothing here
    // may claim to delete.
    const last = SECTIONS.at(-1)!;
    expect(last.title).toBe('Account');
    expect(last.destructive).toBeUndefined();
    expect(last.fields.map(f => f.key)).toContain('signOut');
    expect(SECTIONS.flatMap(s => s.fields).map(f => f.label))
      .not.toContain('Delete my account and everything in it');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/__tests__/Settings.test.tsx`
Expected: FAIL on both edited cases — the last section is still titled `'Delete account'`, still `destructive: true`, and has no `signOut` field.

- [ ] **Step 3: Replace the section**

In `apps/web/src/pages/Settings/sections.ts`, replace the final section:

```ts
  {
    title: 'Delete account',
    destructive: true,
    fields: [
      {
        key: 'deleteAccount', label: 'Delete my account and everything in it', kind: 'action',
        help: 'Removes every capture, link and comment. This cannot be undone.',
      },
    ],
  },
```

with:

```ts
  {
    /** Signing out is not destructive, so this section is not flagged as such.
     * It replaces a "Delete account" section whose only control was wired to
     * signOut — a destructive label on a reversible action, which meant the
     * account could not actually be deleted and looked as though it could. Real
     * deletion is a server-side feature and lands separately. */
    title: 'Account',
    fields: [
      {
        key: 'signOut', label: 'Sign out', kind: 'action',
        help: 'Ends this session on this device. Your captures stay where they are.',
      },
    ],
  },
```

- [ ] **Step 4: Re-key the action wiring**

In `apps/web/src/pages/Settings.tsx:117`, replace:

```tsx
          onAction={field.key === 'deleteAccount' ? onSignOut : undefined}
```

with:

```tsx
          onAction={field.key === 'signOut' ? onSignOut : undefined}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/__tests__/Settings.test.tsx`
Expected: PASS — including the unique-key case at the end of the file, which still holds because `signOut` replaces `deleteAccount` rather than joining it.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/Settings/sections.ts apps/web/src/pages/Settings.tsx apps/web/src/pages/__tests__/Settings.test.tsx
git commit -m "fix(web): stop labelling sign out as account deletion in Settings"
```

---

### Task 6: Disable magic-link sign-in

**Files:**
- Modify: `apps/web/src/pages/Login/SignInPanel.tsx`
- Modify: `apps/web/src/pages/Login/SignInFailed.tsx:31-33` and `:47-53`
- Test: `apps/web/src/pages/__tests__/Login.test.tsx` (exists, rewrite three cases)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no signature change. `SignInPanelProps.onMagicLink` stays required so `ReturnToTask.tsx:11` and the existing tests keep compiling, and re-enabling is a small revert. It simply stops being called.

- [ ] **Step 1: Rewrite the failing tests**

In `apps/web/src/pages/__tests__/Login.test.tsx`, the three magic-link cases at lines 27-31, 33-40, and 42-48 assert behavior that is being removed. Replace those three with:

```tsx
  it('offers Google and explains that email sign-in is not ready', () => {
    render(<SignInPanel onGoogle={() => {}} onMagicLink={() => {}} />);
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.getByText(/Email sign-in is coming soon/i)).toBeInTheDocument();
  });

  it('disables the email field and its button', () => {
    render(<SignInPanel onGoogle={() => {}} onMagicLink={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Send a sign-in link/i })).toBeDisabled();
  });

  it('never sends a link, even if the form is submitted directly', () => {
    const onMagicLink = vi.fn();
    const { container } = render(<SignInPanel onGoogle={() => {}} onMagicLink={onMagicLink} />);
    // Disabled controls cannot be clicked, but a form can still be submitted
    // programmatically or by Enter — the guard has to be in the handler.
    fireEvent.submit(container.querySelector('form')!);
    expect(onMagicLink).not.toHaveBeenCalled();
  });
```

Add `fireEvent` to the `@testing-library/react` import if it is not already there. Leave the Terms/Privacy case (lines 50-54) and the whole `ReturnToTask` suite (lines 57-99) alone — `ReturnToTask` renders `SignInPanel`, so if any of its cases assert magic-link submission they must be updated the same way; read them before assuming.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/__tests__/Login.test.tsx`
Expected: FAIL — the new copy is absent and neither control is disabled.

- [ ] **Step 3: Disable the form**

In `apps/web/src/pages/Login/SignInPanel.tsx`, replace the `submit` handler:

```tsx
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    onMagicLink(email.trim());
  };
```

with:

```tsx
  /** Email sign-in is switched off for now. The controls below are disabled, so
   * this normally cannot fire — but a form still submits on Enter and can be
   * submitted programmatically, so the refusal lives here too rather than
   * resting on the disabled attributes alone. */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
  };
```

`EMAIL` and the `error` state become unused. Delete the `EMAIL` constant, the `error` state, and the `{error && ...}` block, and drop `aria-invalid`/`aria-describedby` from the input — `tsc` with the project's settings will flag the unused bindings otherwise. Keep the `email`/`setEmail` state so the field stays a controlled input.

Add `disabled` to the input and simplify its border, which referenced `error`:

```tsx
          <input
            type="email"
            aria-label="Email"
            disabled
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              height: 'var(--sr-h-md)', padding: '0 12px',
              border: '1px solid var(--sr-border-light)',
              background: 'var(--sr-surface-panel-light)', fontSize: 13.5,
              color: 'var(--sr-text-faint-on-light)',
              borderRadius: 'var(--sr-radius-control)',
            }}
          />
```

Replace the explanatory line:

```tsx
        <span style={{ fontSize: 12, color: 'var(--sr-text-muted-on-light)' }}>
          No password. We send a one-time link.
        </span>
```

with:

```tsx
        <span style={{ fontSize: 12, color: 'var(--sr-text-muted-on-light)' }}>
          Email sign-in is coming soon. Use Google for now.
        </span>
```

Disable the submit button:

```tsx
        <button type="submit" disabled style={{
          height: 'var(--sr-h-md)', border: 'none',
          background: 'var(--sr-border-light)',
          color: 'var(--sr-text-faint-on-light)',
          fontSize: 13.5, fontWeight: 600, cursor: 'not-allowed',
          borderRadius: 'var(--sr-radius-control)',
        }}>Send a sign-in link</button>
```

- [ ] **Step 4: Fix the failure screen that points at email**

`apps/web/src/pages/Login/SignInFailed.tsx` tells an `adminBlocked` user to "Use email sign-in" — with magic link off, that is a dead end into the one method that no longer works.

Replace the `adminBlocked` copy:

```ts
  adminBlocked: {
    title: 'Your workspace has not approved SnapRec',
    body: 'Your workspace admin has not approved SnapRec. Use email sign-in, or send them the approval link.',
  },
```

with:

```ts
  adminBlocked: {
    title: 'Your workspace has not approved SnapRec',
    body: 'Your workspace admin has not approved SnapRec yet. Send them the approval link — email sign-in is not available yet.',
  },
```

And replace its two buttons:

```tsx
        {kind === 'adminBlocked' ? (
          <>
            <button type="button" onClick={onEmailInstead ?? onRetry} style={primary}>
              Use email sign-in
            </button>
            <button type="button" onClick={onApprovalLink ?? onRetry} style={secondary}>
              Send the approval link
            </button>
          </>
        ) : (
```

with:

```tsx
        {kind === 'adminBlocked' ? (
          <>
            <button type="button" onClick={onApprovalLink ?? onRetry} style={primary}>
              Send the approval link
            </button>
          </>
        ) : (
```

Leave `onEmailInstead` in `SignInFailedProps` — it is optional, no caller passes it (`AuthCallback.tsx:86`), and removing it is churn that reverses when email returns.

The `linkUsed` and `wrongBrowser` states are deliberately left alone: they are reachable by anyone still holding an emailed link, so their copy remains accurate for that case. Their "Send a new link" button now cannot succeed, but they already offer "Continue with Google instead" as the second action, so the screen is not a dead end.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/__tests__/Login.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: both clean. `tsc` is the gate that catches the unused `EMAIL`/`error` bindings from Step 3.

- [ ] **Step 7: Verify in the browser**

Run from the repo root: `npm run web dev` and open `/login` signed out.

Confirm the email field and its button are visibly disabled, the "coming soon" line reads correctly, pressing Enter in the field does nothing, and **Continue with Google still signs you in** — it is now the only way in, so a regression here locks everyone out.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/Login/SignInPanel.tsx apps/web/src/pages/Login/SignInFailed.tsx apps/web/src/pages/__tests__/Login.test.tsx
git commit -m "feat(web): disable email sign-in with a coming-soon note"
```
