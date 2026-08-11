# Patreon Button Typing Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "Support us" label inside the dashboard `TopBar`'s Patreon link with a typewriter animation that continuously cycles between "Keep SnapRec free" and "Support us".

**Architecture:** A new standalone hook `useTypewriterCycle(phrases)` in `apps/web/src/hooks/` owns a `setTimeout`-driven type → hold → erase state machine and returns the current display string. `TopBar.tsx` calls it in place of the literal `'Support us'` string, rendering the text in a fixed-width span followed by a CSS-animated blinking cursor. Keeping the timing logic in its own hook file means it can be unit-tested with fake timers without rendering `TopBar` at all.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + React Testing Library + jsdom (existing `apps/web` stack). No new dependencies.

## Global Constraints

- Scope is `apps/web/src/hooks/useTypewriterCycle.ts` (new), `apps/web/src/components/TopBar.tsx` (modify), plus their tests. No other files change.
- Phrases are exactly `'Keep SnapRec free'` then `'Support us'`, in that order, cycling forever. Hardcoded at the `TopBar` call site — no props, env vars, or config.
- Timing constants, verbatim: typing `45`ms/char, erasing `25`ms/char, hold at full phrase `1400`ms, no hold at empty.
- `prefers-reduced-motion: reduce` returns the static string `'Support us'` and starts no timers. Check it with `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches`, matching the existing convention at `apps/web/src/components/CapturePreview.tsx:94`.
- The `<a>`'s `aria-label` and `title` stay exactly `"Support us on Patreon"`. The animated text span is `aria-hidden="true"` so screen readers never announce it character-by-character.
- Fixed label width is a hardcoded pixel value (`124`) sized for `"Keep SnapRec free"` at 13px/600 — no runtime canvas/ref measurement.
- Do not use the design-system `Button` component and never coral: `capture` is reserved for live-capture UI per `CLAUDE.md`. Keep the existing inline `--sr-*` token styling in `TopBar.tsx`.
- Mobile (`useBreakpoint() === 'mobile'`) stays icon-only — the label and therefore the hook must not render at all.
- No hex literals in `.tsx`; colors come from `var(--sr-*)` tokens.

---

### Task 1: The `useTypewriterCycle` hook

**Files:**
- Create: `apps/web/src/hooks/useTypewriterCycle.ts`
- Test: `apps/web/src/hooks/__tests__/useTypewriterCycle.test.ts` (new)

**Interfaces:**
- Consumes: nothing from other tasks. Only React (`useState`, `useEffect`) and `window.matchMedia`.
- Produces: `export function useTypewriterCycle(phrases: string[]): string` — returns the string to display on this render. Task 2 imports exactly this name from `'../hooks/useTypewriterCycle'`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/hooks/__tests__/useTypewriterCycle.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTypewriterCycle } from '../useTypewriterCycle';

const PHRASES = ['Keep SnapRec free', 'Support us'];

const TYPE_MS = 45;
const ERASE_MS = 25;
const HOLD_MS = 1400;

/** Advance fake timers inside act() so React flushes the resulting state. */
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** The machine spends one extra tick at each end of a phrase: the tick that
 * notices the phrase is full (and starts the hold) emits no character, and so
 * does the tick that notices it is empty (and advances the phrase). So a
 * phrase of length L costs L+1 typing ticks and L+1 erasing ticks, and this is
 * the elapsed time from a phrase's first typing tick being scheduled to the
 * tick that hands over to the next phrase. */
const cycle = (len: number) => TYPE_MS * (len + 1) + HOLD_MS + ERASE_MS * (len + 1);

describe('useTypewriterCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts empty and types the first phrase one character at a time', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('K');

    advance(TYPE_MS);
    expect(result.current).toBe('Ke');

    advance(TYPE_MS * 3);
    expect(result.current).toBe('Keep ');
  });

  it('reaches the full first phrase and holds it', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(TYPE_MS * PHRASES[0].length);
    expect(result.current).toBe('Keep SnapRec free');

    // Through the no-op tick that starts the hold, and most of the hold itself.
    advance(TYPE_MS + HOLD_MS - 1);
    expect(result.current).toBe('Keep SnapRec free');
  });

  it('erases the first phrase after the hold, faster than it typed', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    // Typing ticks, the tick that starts the hold, then the hold.
    advance(TYPE_MS * (PHRASES[0].length + 1) + HOLD_MS);
    expect(result.current).toBe('Keep SnapRec fre');

    advance(ERASE_MS);
    expect(result.current).toBe('Keep SnapRec fr');
  });

  it('types the second phrase once the first is fully erased', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(cycle(PHRASES[0].length));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('S');

    advance(TYPE_MS * (PHRASES[1].length - 1));
    expect(result.current).toBe('Support us');
  });

  it('loops back to the first phrase after the last one erases', () => {
    const { result } = renderHook(() => useTypewriterCycle(PHRASES));

    advance(cycle(PHRASES[0].length) + cycle(PHRASES[1].length));
    expect(result.current).toBe('');

    advance(TYPE_MS);
    expect(result.current).toBe('K');
  });

  it('stops its timers on unmount', () => {
    const { unmount } = renderHook(() => useTypewriterCycle(PHRASES));
    advance(TYPE_MS * 3);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('when the viewer asks for less motion', () => {
    it('shows the short phrase statically and never starts a timer', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue(
        { matches: true, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList,
      );

      const { result } = renderHook(() => useTypewriterCycle(PHRASES));
      expect(result.current).toBe('Support us');
      expect(vi.getTimerCount()).toBe(0);

      advance(TYPE_MS * 40);
      expect(result.current).toBe('Support us');
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/web/`: `npx vitest run src/hooks/__tests__/useTypewriterCycle.test.ts`
Expected: FAIL — `Failed to resolve import "../useTypewriterCycle"`, because the hook file does not exist yet.

- [ ] **Step 3: Write the hook**

Create `apps/web/src/hooks/useTypewriterCycle.ts`:

```ts
import { useEffect, useState } from 'react';

const TYPE_MS = 45;
const ERASE_MS = 25;
const HOLD_MS = 1400;

/** The label types one phrase in, holds it long enough to read, erases it, and
 * moves to the next — forever. Erasing runs faster than typing because a
 * viewer re-reading text they have already seen only needs the motion cue.
 *
 * Returns the string for this render. Reduced motion collapses the whole
 * machine to the shortest phrase, which is the one that still reads as a
 * label rather than a sentence. */
export function useTypewriterCycle(phrases: string[]): string {
  const [text, setText] = useState('');

  const still = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  useEffect(() => {
    if (still) return;

    let phrase = 0;
    let chars = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const target = phrases[phrase];

      if (!erasing && chars === target.length) {
        erasing = true;
        timer = setTimeout(step, HOLD_MS);
        return;
      }

      if (erasing && chars === 0) {
        erasing = false;
        phrase = (phrase + 1) % phrases.length;
        // Flow straight into typing the next phrase; no hold at empty.
        timer = setTimeout(step, TYPE_MS);
        return;
      }

      chars += erasing ? -1 : 1;
      setText(phrases[phrase].slice(0, chars));
      timer = setTimeout(step, erasing ? ERASE_MS : TYPE_MS);
    };

    timer = setTimeout(step, TYPE_MS);
    return () => clearTimeout(timer);
  }, [phrases, still]);

  if (still) return phrases.reduce((a, b) => (b.length < a.length ? b : a));
  return text;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `apps/web/`: `npx vitest run src/hooks/__tests__/useTypewriterCycle.test.ts`
Expected: PASS — all 7 tests green.

The tests encode the machine's two no-op ticks per phrase (the tick that notices a phrase is full and starts the hold, and the tick that notices it is empty and advances the phrase) in the `cycle()` helper. Do not "fix" the hook to skip those ticks — collapsing them would emit the next phrase's first character in the same tick that erasing finishes, which reads as a jump cut rather than a typed character.

**A caller must pass a referentially stable `phrases` array.** A fresh array literal on every render would re-run the effect and restart the animation from empty each time. Task 2 satisfies this with a module-level constant.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useTypewriterCycle.ts apps/web/src/hooks/__tests__/useTypewriterCycle.test.ts
git commit -m "feat(web): add useTypewriterCycle hook for cycling label animation"
```

---

### Task 2: Wire the animated label into TopBar

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx` (the `PATREON_URL` constant area near line 25, and the Patreon `<a>` at lines 138-154)
- Modify: `apps/web/src/components/__tests__/TopBar.test.tsx` (the two label assertions at lines 29-32 and 34-39)
- Modify: `apps/web/src/index.css` (append the cursor keyframes)

**Interfaces:**
- Consumes: `useTypewriterCycle(phrases: string[]): string` from `'../hooks/useTypewriterCycle'` (Task 1).
- Produces: nothing new is exported. `TopBarProps` is unchanged — no new props.

- [ ] **Step 1: Write the failing tests**

Replace the two label tests in `apps/web/src/components/__tests__/TopBar.test.tsx` — that is, delete the existing `it('shows the "Support us" label at desktop width', ...)` (lines 29-32) and `it('collapses to icon-only on mobile, keeping an accessible name', ...)` (lines 34-39) blocks and put these in their place. Leave the file's imports, `vi.mock`, `user`, `mount`, and the first test (`links to the SnapRec Patreon page in a new tab`) exactly as they are.

```tsx
  it('animates the label at desktop width, starting from the first phrase', () => {
    mount();
    const label = screen.getByTestId('patreon-label');
    expect(label).toBeInTheDocument();
    // aria-hidden so the typing text is never announced character-by-character;
    // the accessible name comes from the link's aria-label instead.
    expect(label).toHaveAttribute('aria-hidden', 'true');
  });

  it('collapses to icon-only on mobile, keeping an accessible name', () => {
    vi.mocked(useBreakpoint).mockReturnValue('mobile');
    mount();
    expect(screen.queryByTestId('patreon-label')).toBeNull();
    expect(screen.getByRole('link', { name: /Support us on Patreon/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/web/`: `npx vitest run src/components/__tests__/TopBar.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="patreon-label"]`. The mobile test may pass already (the element doesn't exist anywhere yet), which is fine; the desktop test must fail.

- [ ] **Step 3: Add the import and the phrases constant**

In `apps/web/src/components/TopBar.tsx`, add the import after the existing `useBreakpoint` import (line 3):

```tsx
import { useTypewriterCycle } from '../hooks/useTypewriterCycle';
```

Add the phrases constant immediately after the existing `PATREON_URL` line (line 25). It must live at module scope so its identity is stable across renders — a literal passed inline would restart the animation on every render:

```tsx
const PATREON_PHRASES = ['Keep SnapRec free', 'Support us'];

/** Sized for "Keep SnapRec free" at 13px/600 plus the cursor, so the label's
 * box never changes as characters come and go. Without this the search box and
 * every control between it and the link twitch on every keystroke of the
 * animation. */
const PATREON_LABEL_WIDTH = 124;
```

- [ ] **Step 4: Add the local label component**

In the same file, add this component immediately after the `PATREON_LABEL_WIDTH` constant and before `export function TopBar(`. It is a separate component, not inline JSX inside `TopBar`, so the hook's per-tick state updates re-render only the label rather than the whole top bar:

```tsx
function PatreonLabel() {
  const text = useTypewriterCycle(PATREON_PHRASES);
  return (
    <span
      data-testid="patreon-label"
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center',
        width: PATREON_LABEL_WIDTH, flex: 'none',
      }}
    >
      {text}
      <span className="sr-caret" aria-hidden="true" style={{ marginLeft: 1 }}>|</span>
    </span>
  );
}
```

- [ ] **Step 5: Render it in place of the static string**

In the Patreon `<a>` (lines 138-154), replace this line:

```tsx
          {!mobile && 'Support us'}
```

with:

```tsx
          {!mobile && <PatreonLabel />}
```

Everything else about the `<a>` — `href`, `target`, `rel`, `aria-label`, `title`, the `style` object, and the `<Icon icon="simple-icons:patreon" ... />` — stays exactly as it is.

- [ ] **Step 6: Add the cursor keyframes**

Append to the end of `apps/web/src/index.css`:

```css
/* The caret blinks on its own clock rather than off the typing timer, so the
   text stays legible while it is being typed. `steps(1)` gives a hard on/off
   blink instead of a fade, which reads as a terminal caret. */
@keyframes sr-caret-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.sr-caret {
  animation: sr-caret-blink 1s steps(1) infinite;
  color: var(--sr-text-faint-on-light);
}

@media (prefers-reduced-motion: reduce) {
  .sr-caret { display: none; }
}
```

- [ ] **Step 7: Run the TopBar tests to verify they pass**

Run from `apps/web/`: `npx vitest run src/components/__tests__/TopBar.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 8: Run the full web test suite to check for regressions**

Run from `apps/web/`: `npx vitest run`
Expected: PASS. Pay attention to `src/components/__tests__/AppShell.test.tsx`, which renders `TopBar` indirectly. It does not mock `useBreakpoint`, so it renders at the jsdom default width, which `useBreakpoint`'s server snapshot and `window.innerWidth` (1024 in jsdom) put above the `mobile` rung — meaning `PatreonLabel` mounts and its timers start. Its assertions target "New capture" and "Activity", not the Patreon label, so they are unaffected. If any test warns about state updates after teardown, the cause would be the hook's `setTimeout` outliving the test; the hook's cleanup clears it, so this should not appear — if it does, do not silence the warning, verify the `return () => clearTimeout(timer)` in Task 1 Step 3 is present.

- [ ] **Step 9: Typecheck and lint**

Run from `apps/web/`: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 10: Verify it in the browser**

Run from the repo root: `npm run web dev`, open `http://localhost:5173`, sign in, and look at the top-right of the dashboard.

Confirm by eye:
- The label types out "Keep SnapRec free", holds it about a second and a half, erases it, then types "Support us", and keeps alternating.
- The caret blinks throughout.
- Nothing to the left of the link (the search box, "New capture", the bell, the avatar) shifts horizontally at any point in the cycle. If it does, `PATREON_LABEL_WIDTH` is too small — raise it until the longest phrase plus caret fits.
- Narrowing the window below 768px collapses the control to the icon alone.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/TopBar.tsx apps/web/src/components/__tests__/TopBar.test.tsx apps/web/src/index.css
git commit -m "feat(web): animate the Patreon label with a cycling typewriter effect"
```
