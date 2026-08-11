# Patreon support button — typing animation design

## Purpose

The Patreon link in `TopBar.tsx` (added per [`2026-08-12-patreon-support-button-design.md`](./2026-08-12-patreon-support-button-design.md)) currently shows a static "Support us" label. To catch a user's eye without adding a second control or a loud coral CTA, the label itself types out two alternating phrases — "Keep SnapRec free" and "Support us" — in a continuous typewriter loop.

## Scope

- `apps/web/src/components/TopBar.tsx` — replace the static `'Support us'` label text with the animated output.
- New file: `apps/web/src/hooks/useTypewriterCycle.ts` — a small, standalone hook that owns the typing/pausing/erasing state machine. Kept separate from `TopBar.tsx` so the timing logic is unit-testable with fake timers without rendering the component.
- No other files change. Icon, link target, `aria-label`/`title`, new-tab behavior, and mobile icon-only collapse are all unchanged from the existing shipped button.

## Behavior

### Phrase cycle

Phrases, in order, looping forever:

1. `"Keep SnapRec free"`
2. `"Support us"`

Per phrase: type in character-by-character → hold at full length → erase character-by-character → move to the next phrase. After the last phrase erases, the cycle restarts from the first. This runs indefinitely for as long as the component is mounted — it does not settle or stop after N cycles.

### Timing

- Typing speed: 45ms per character.
- Erasing speed: 25ms per character (faster than typing, standard typewriter-effect convention).
- Hold at full phrase length: 1400ms before erasing begins.
- No hold at zero length — erasing one phrase flows straight into typing the next.

These are constants in `useTypewriterCycle.ts`, not configurable props (YAGNI — this hook has exactly one caller).

### Cursor

A blinking `|` cursor renders after the text at all times (typing, holding, erasing), via a pure CSS `steps()` opacity/visibility animation on a `<span aria-hidden="true">` — not driven by the JS timing state, so it blinks independently and doesn't need to sync with character timing.

### Layout stability

The label sits in a fixed-width inline container sized to fit `"Keep SnapRec free"` at the button's font (13px/600) plus the cursor glyph, text left-aligned. This width is measured once (a hardcoded pixel value derived from the phrase at that font, not measured at runtime via canvas/ref — no layout-measurement machinery for a two-phrase static set) and does not change as text grows/shrinks through the type/erase cycle. This keeps the rest of `TopBar` (search box, other buttons) from jittering as the label's actual text content changes length every animation frame.

### Reduced motion

`prefers-reduced-motion: reduce` (checked via `window.matchMedia`, same pattern as any other reduced-motion check in the codebase would use — this is the first one, so it's a plain media query read, no new dependency) disables the animation entirely: the hook returns the static string `"Support us"` and never starts its timers. The blinking cursor is also suppressed in this case (a static cursor or no cursor — no cursor, simplest).

### Mobile

Unchanged from the existing shipped behavior: below the `mobile` breakpoint, `TopBar` renders icon-only and never mounts the label span, so `useTypewriterCycle` is not invoked and no timers run. This is existing conditional rendering (`{!mobile && ...}`), not new logic.

### Accessibility

`aria-label="Support us on Patreon"` and `title="Support us on Patreon"` on the `<a>` stay exactly as they are today — fixed strings, independent of the visual typing text. The animated span itself is `aria-hidden="true"` (the accessible name already comes from `aria-label` on the parent link, so the visual text is decorative from a screen-reader perspective and must not be announced character-by-character or re-announced on every state change).

## Interface

```ts
// apps/web/src/hooks/useTypewriterCycle.ts
export function useTypewriterCycle(phrases: string[]): string;
```

Takes the ordered list of phrases (`['Keep SnapRec free', 'Support us']` at the call site) and returns the current display string for this render. All timing constants live inside the hook. Internally manages its own `setTimeout` loop and cleans it up on unmount; respects `prefers-reduced-motion` internally rather than requiring the caller to check it.

`TopBar.tsx` usage replaces the current `{!mobile && 'Support us'}` with:

```tsx
{!mobile && <Typewriter />}
```

where `Typewriter` is a tiny local component (or inline JSX) that calls the hook and renders the fixed-width span + text + CSS cursor.

## Testing

- `useTypewriterCycle.test.ts` (new): with `vi.useFakeTimers()`, assert the returned string at key points — partway through typing the first phrase, at full first phrase, partway through erasing, at full second phrase, and that it wraps back to typing the first phrase again after a full cycle. Also assert it returns the static `'Support us'` immediately and starts no timers when `prefers-reduced-motion: reduce` is mocked true.
- `TopBar.test.tsx` (existing, needs updating): the current assertion `screen.getByText('Support us')` no longer holds structurally once the label is animated text that changes over time. Replace with an assertion on the link's `aria-label`/role (already covered by the "links to the SnapRec Patreon page" test) and, if wanted, an assertion that some non-empty text node exists inside the link at time zero. The mobile-collapse test (`queryByText('Support us')` returns null) is replaced with a check that the animated label container isn't rendered at all on mobile.

## Out of scope

- No hover-to-pause, click-to-skip, or other interaction with the animation itself.
- No settling/stopping after N cycles — confirmed as continuous forever.
- No configurability (props, env, CMS-driven copy) — two hardcoded phrases.
- No changes to icon, link target, new-tab behavior, or the existing responsive icon-only collapse.
