# Patreon support button — design

## Purpose

Add a quiet, always-visible link to the SnapRec Patreon page so logged-in users can help cover cloud/hosting costs and keep the product free. Not a growth/marketing CTA — a low-key "chip in" affordance for people already using the app.

## Scope

- Logged-in dashboard only: `TopBar.tsx`, rendered on every authenticated route (`/home`, `/library`, `/projects`, `/shared`, `/analytics`, `/settings`) via `AppShell.tsx`.
- Not added to the marketing site navbar/footer, and not added to the extension popup. Both are out of scope for this change.

## Placement

Right-side control group of `TopBar.tsx` (`apps/web/src/components/TopBar.tsx`), which currently holds, in order: search box → "New capture" → activity/bell → avatar menu.

The Patreon link goes **last**, after the avatar menu — the quietest slot, furthest from the primary "New capture" action, so it doesn't compete with it.

## Style

- A plain `<a target="_blank" rel="noopener">`, styled inline with the same `--sr-*` design tokens TopBar already uses for its other controls (TopBar doesn't use the design-system `Button` component, so this stays consistent with its raw-button/token convention rather than introducing `Button` just for one control).
- Neutral/outline weight — visually quieter than "New capture" (black-filled) and never coral (`capture` variant is reserved for live-capture/needs-response UI per project convention).
- Icon: Patreon mark via `@iconify/react`'s `simple-icons:patreon` string identifier; `@iconify/react` is an existing dependency, and icon data is resolved from Iconify's CDN at runtime (same as other icons already in TopBar like `ant-design:search-outlined`).
- Label: "Support us", shown next to the icon at normal widths.

## Responsive behavior

TopBar has no existing breakpoint logic and is already tight at narrow/tablet widths (fixed 300px search box + 3 controls). Rather than introduce new hide-on-mobile logic for the whole row, the Patreon control collapses to icon-only (drop the "Support us" label, keep the icon with a `title` tooltip) below the existing `useBreakpoint()` mobile threshold already used in `AppShell.tsx`.

## Behavior

- Opens the Patreon page in a new tab (`target="_blank" rel="noopener"`).
- No tracking/analytics beyond what the app already captures globally (none added specifically for this).

## Additional surfaces (added 2026-08-13)

The dashboard is not the only place a user spends time, so the ask is extended to the viewers and both editors. Confirmed in conversation: all four surfaces, static (no typewriter animation — these are dense working toolbars where a looping animation competes with the task).

A shared `SupportButton` component carries it, rather than six hand-rolled links:

```tsx
export interface SupportButtonProps {
  surface: 'dark' | 'light';
  /** Icon only, for dense bars and mobile. */
  compact?: boolean;
}
```

`surface` is explicit rather than inferred, because these pages do not share a theme and there is no context to read it from. Per `CLAUDE.md`, editors and the video viewer are dark "Technical" workspaces with explicit dark tokens; the image viewer is a light surface. No `dark:` utilities.

| Surface | File | Theme | Placement |
| --- | --- | --- | --- |
| Video viewer | `pages/Share/VideoViewer.tsx` | dark | Right group, before Download |
| Image viewer | `pages/Share/ImageShare.tsx` | light | Header, before Download |
| Screenshot editor | `pages/Editor.tsx` (`EditorActions`) | dark | After the undo/redo divider |
| Video editor | `pages/VideoEditor/VideoEditorChrome.tsx` | dark | Alongside `UserMenu` in the existing `trailing` slot |
| Mobile video viewer | `pages/Share/MobileVideoShare.tsx` | dark | A row in the existing overflow `BottomSheet` — the top bar is already full |
| Mobile image viewer | `pages/Share/MobileImageShare.tsx` | light | Header, compact |

Note on audience: the two viewers are public share pages, so the ask reaches recipients who may not use SnapRec rather than the owner. This was raised and accepted deliberately — every shared link becomes an impression. The button stays visually quiet (outlined, never coral, never the primary action) so it does not compete with Copy link or Download on someone else's content.

`Editor.tsx` uses Material Symbols glyphs while the Share pages use `@iconify/react`. `SupportButton` brings its own Iconify import, so it stays consistent with itself across surfaces rather than matching each file's local icon convention.

## Out of scope / explicitly not doing

- No Patreon widget/embed, no OAuth or Patreon API integration — this is a static outbound link.
- No A/B testing or copy variants — single fixed label.
- No placement on marketing pages, footer, or extension popup.
