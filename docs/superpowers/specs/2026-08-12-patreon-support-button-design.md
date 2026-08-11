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
- Icon: Patreon mark via `@iconify/react`'s `simple-icons:patreon` (already a dependency in this monorepo; no new package).
- Label: "Support us", shown next to the icon at normal widths.

## Responsive behavior

TopBar has no existing breakpoint logic and is already tight at narrow/tablet widths (fixed 300px search box + 3 controls). Rather than introduce new hide-on-mobile logic for the whole row, the Patreon control collapses to icon-only (drop the "Support us" label, keep the icon with a `title` tooltip) below the existing `useBreakpoint()` mobile threshold already used in `AppShell.tsx`.

## Behavior

- Opens the Patreon page in a new tab (`target="_blank" rel="noopener"`).
- No tracking/analytics beyond what the app already captures globally (none added specifically for this).

## Out of scope / explicitly not doing

- No Patreon widget/embed, no OAuth or Patreon API integration — this is a static outbound link.
- No A/B testing or copy variants — single fixed label.
- No placement on marketing pages, footer, or extension popup.
