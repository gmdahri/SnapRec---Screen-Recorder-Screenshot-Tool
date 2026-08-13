# Patreon Support Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quiet outbound link to SnapRec's Patreon page (`https://www.patreon.com/cw/SnapRec`) in the logged-in dashboard's `TopBar`, so users can help cover hosting costs.

**Architecture:** A single new control (`<a>`) added to the existing right-side button group in `apps/web/src/components/TopBar.tsx`, styled with the same inline `--sr-*` token convention already used by its neighbors (the bell and avatar buttons). `TopBar` calls `useBreakpoint()` directly (the project's established per-component pattern — see `apps/web/src/hooks/useBreakpoint.ts:5-8`) to know when to drop its text label. No other file needs to change: `AppShell.tsx` passes no new props, and no new dependency is added.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + React Testing Library (existing `apps/web` test stack), `@iconify/react` (already a transitive dependency, used elsewhere in `TopBar.tsx`).

## Global Constraints

- Scope is `apps/web/src/components/TopBar.tsx` only — no changes to the marketing site (`LandingNavbar.tsx`), footer, or the extension popup (per spec, `docs/superpowers/specs/2026-08-12-patreon-support-button-design.md`).
- Do not use the design-system `Button` component or its `capture` (coral) variant — `capture` is reserved for live-capture/needs-response UI per `CLAUDE.md`. Style the link manually with the `control` token object already defined in `TopBar.tsx:16-22`.
- Icon is Iconify's `simple-icons:patreon` via the `Icon` component already imported in `TopBar.tsx:2`. Do not add a new icon package.
- Link opens in a new tab: `target="_blank" rel="noopener"`.
- Placement: last item in the right-side control group (`TopBar.tsx:88-132`), after the avatar/user-menu button.
- Label "Support us" is shown next to the icon at all breakpoints except `mobile` (`useBreakpoint()` returning `'mobile'`), where only the icon shows, with the accessible name preserved via `aria-label`/`title`.
- Patreon URL is `https://www.patreon.com/cw/SnapRec`, hardcoded as a named constant — no env var, no config file (it's a single static public URL, not secret or environment-specific).

---

### Task 1: Add the Patreon link to TopBar

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`
- Test: `apps/web/src/components/__tests__/TopBar.test.tsx` (new file)

**Interfaces:**
- Consumes: `useBreakpoint()` from `apps/web/src/hooks/useBreakpoint.ts` (already exists, returns `'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop'`).
- Produces: nothing new is exported. `TopBarProps` is unchanged — no new props.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/__tests__/TopBar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from '../TopBar';
import { useBreakpoint } from '../../hooks/useBreakpoint';

vi.mock('../../hooks/useBreakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

const user = { initials: 'PR', name: 'Priya Raman' };

const mount = () => render(
  <TopBar title="Home" user={user} onNewCapture={() => {}} />,
);

describe('TopBar Patreon link', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue('desktop');
  });

  it('links to the SnapRec Patreon page in a new tab', () => {
    mount();
    const link = screen.getByRole('link', { name: /Support us on Patreon/ });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('shows the "Support us" label at desktop width', () => {
    mount();
    expect(screen.getByText('Support us')).toBeInTheDocument();
  });

  it('collapses to icon-only on mobile, keeping an accessible name', () => {
    vi.mocked(useBreakpoint).mockReturnValue('mobile');
    mount();
    expect(screen.queryByText('Support us')).toBeNull();
    expect(screen.getByRole('link', { name: /Support us on Patreon/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/TopBar.test.tsx` (from `apps/web/`)
Expected: FAIL — no element with role `link` and name `/Support us on Patreon/` exists yet.

- [ ] **Step 3: Add the `useBreakpoint` import and `PATREON_URL` constant**

In `apps/web/src/components/TopBar.tsx`, add the import alongside the existing ones (after line 2):

```tsx
import { useBreakpoint } from '../hooks/useBreakpoint';
```

Add the constant after the `control` object (after line 22):

```tsx
const PATREON_URL = 'https://www.patreon.com/cw/SnapRec';
```

- [ ] **Step 4: Read the breakpoint inside the component**

Inside `TopBar`, right after `const searchRef = useRef<HTMLInputElement>(null);` (line 28), add:

```tsx
const breakpoint = useBreakpoint();
const mobile = breakpoint === 'mobile';
```

- [ ] **Step 5: Render the link as the last item in the right-side group**

In `TopBar.tsx`, inside the right-side `<span>` (starting at line 88), insert the new `<a>` immediately after the avatar/user-menu `<button>` closes (after line 131), still inside the same `<span>` (before its closing tag at line 132):

```tsx
<a
  href={PATREON_URL}
  target="_blank"
  rel="noopener"
  aria-label="Support us on Patreon"
  title="Support us on Patreon"
  style={{
    ...control,
    padding: mobile ? '0 8px' : '0 12px',
    display: 'inline-flex', alignItems: 'center', gap: 7,
    color: 'var(--sr-text-muted-on-light)', textDecoration: 'none',
    fontSize: 13, fontWeight: 600,
  }}
>
  <Icon icon="simple-icons:patreon" width={14} aria-hidden="true" />
  {!mobile && 'Support us'}
</a>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/TopBar.test.tsx` (from `apps/web/`)
Expected: PASS — all 3 tests green.

- [ ] **Step 7: Run the full web test suite to check for regressions**

Run: `npm run test --workspace=apps/web -- run` (or `cd apps/web && npx vitest run`)
Expected: PASS — in particular `src/components/__tests__/AppShell.test.tsx`, which renders `TopBar` indirectly, should still pass unchanged (it doesn't mock `useBreakpoint`, so it renders at jsdom's default width, landing above the `mobile` rung and showing the full "Support us" label — its existing assertions don't reference the right-side group's contents beyond "New capture" and "Activity", so they aren't affected).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/TopBar.tsx apps/web/src/components/__tests__/TopBar.test.tsx
git commit -m "feat(web): add Patreon support link to dashboard TopBar"
```
