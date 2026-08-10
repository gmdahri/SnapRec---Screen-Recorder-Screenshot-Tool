# Design system

`packages/design-system` is the plate visual language. `src/tokens.css` is the
single source of truth — a colour literal anywhere else is a bug, enforced by
`__tests__/no-hex.test.ts` (which catches hex, `rgb()`, `rgba()` and `hsl()`).

## Primitives

**P0 — controls and surfaces**
`Button` · `IconButton` · `Frame` · `Logo` · `SegmentedControl` · `Switch` ·
`Mono` · `Field`

**P1 — the capture vocabulary**
`CapturePlate` · `CaptureRow` · `CaptureFrame` · `StateRule` · `StatusBadge` ·
`ActivityRow` · `SelectionBar` · `AppRail` · `PathSpine`

## The capture state model

`src/status.ts` holds `CAPTURE_STATES` — thirteen states, each carrying its
label, rule treatment, primary action and capability flags:

```ts
CAPTURE_STATES.processing
// { label: 'processing', rule: 'cyan-full', ruleWidth: '100%',
//   primary: 'Copy link', secondary: ['rename', 'delete'],
//   canPreview: false, canShare: true, canSelect: false, survivesLeaving: true }
```

**Every surface reads this record.** No page decides for itself what
`uploading` looks like, or whether a processing capture can be shared, or which
action leads its edge rail. `CapturePlate` drops its media and its checkbox for
`processing` because the model says so — not because a page remembered to.

Adding a state means adding it here first, then to `STATUS_WORDS`, then letting
the tests tell you which surfaces need updating.

## Rules the components exist to enforce

- **Coral is reserved** for live capture and needs-a-response. `StatusBadge`
  hard-codes the two statuses permitted to wear it.
- **Status never rests on hue alone.** `StateRule` is `aria-hidden`; the word
  always comes from `StatusBadge` beside it.
- **Offline is not failure.** `queuedOffline` draws dashed grey. `PathSpine`
  and `StateRule` both refuse to give it coral.
- **Green appears only on completed path nodes.** Never a button, badge or
  background.
- **Disabled actions carry their reason.** `CaptureAction.disabledReason`
  becomes the tooltip; there is no way to disable an action silently.
- **Registration marks mean focused-but-not-editable.** `CaptureFrame`'s
  `editable` treatment — solid handles — is permitted on exactly two surfaces
  in the product: the video editor's trim points and the image editor's crop
  overlay.

## What is deliberately absent

- **No Card.** `CapturePlate` replaces it. Wanting a card means working around
  the state model.
- **No filled status pills.** `StatusBadge` is outlined at 19px.
- **No `dark:` utilities.** Dark is a `surface` prop, not a theme. Management
  surfaces are light-only; dark is reserved for Technical workspaces.
- **No seventh control height.** Six exist: 30 / 32 / 34 / 36 / 40 / 46, gated
  by `controls.test.tsx`.

## Testing

```bash
npm test --workspace=packages/design-system
npm run test --workspace=apps/web
```

The contrast suite parses `tokens.css` and fails if any text pair drops below
WCAG AA. It is why `--sr-text-faint-on-light` is `#656E71` rather than the
standalone prototypes' `#8D989B`, which measures 2.86:1 on paper. **Do not relax
it to match a mockup** — the mockup is wrong.
