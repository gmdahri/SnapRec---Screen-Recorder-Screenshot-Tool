# Dashboard fixes: extension detection, card geometry, account menu, magic link — design

## Scope

Five independent changes to the logged-in web dashboard and login page. They share no state and can ship in any order; they are specified together because they were reported together.

1. Extension detection reports "not installed" when the extension is installed.
2. Capture cards render at unequal heights.
3. The profile avatar navigates to Settings instead of opening a menu.
4. There is no sign-out control in the dashboard.
5. Magic-link sign-in should be disabled with a "coming soon" note.

Items 3 and 4 are one implementation (the menu is where sign-out lives), so they are specified as a single section below.

---

## 1. Extension detection false negative

### Root cause

`apps/web/src/hooks/useExtensionStatus.ts:52` reads `VITE_EXTENSION_ID` from the Vite env. That variable is **absent from `apps/web/.env`** and empty in `apps/web/.env.example:16`. `ping()` short-circuits at line 56:

```ts
if (!EXTENSION_ID || !runtime?.sendMessage) return Promise.resolve(null);
```

`null` maps to `notInstalled` in `detectExtension`. So every Chromium user is told the extension is missing regardless of whether it is installed, because the ping is never sent. The extension side is correct and needs no change: `apps/extension/background/background.js:1327-1332` answers `PING` with its version, and `manifest.json:115-120` lists the web origins under `externally_connectable`.

A second, independent defect compounds it: `useExtensionStatus` initialises to `notResponding` (line 67), which is a *failure* state, not a loading state. Before the ping resolves — up to the full 1200ms timeout — `ExtensionNotice` renders the "installed but not responding" card, the rail shows `off`, and Settings disables extension-owned fields. The user sees a wrong answer, then a correct one.

### Fix

Set the published extension ID in both env files:

```
VITE_EXTENSION_ID=lgafjgnifbjeafallnkkfpljgbilfajg
```

This is the ID from the store URL already hardcoded in `apps/web/src/components/AddToChromeButton.tsx:9`. It is a public identifier, not a secret.

Add a `'checking'` member to `ExtensionStatus` and make it the initial state. Every consumer treats `'checking'` as "say nothing yet" rather than as a failure:

- `pages/Home/ExtensionNotice.tsx` — render `null` for `'checking'` as well as `'connected'`.
- `components/AppShell.tsx:41-46` — map `'checking'` to the existing `'unknown'` rail tone.
- `pages/Settings.tsx:20` — `extensionAbsent` must be false while `'checking'`, so fields are not disabled and then re-enabled.
- `pages/Home/NewUser.tsx:20` and `components/CapturePopover.tsx:19` already compare against `'connected'`; verify their else-branch copy does not assert absence during `'checking'`.

The 1200ms timeout in `detectExtension` is not cleared when the ping wins the race (`useExtensionStatus.ts:28-30`). Clear it, so mounting the hook does not leave a pending timer.

### Deployment requirement (not code)

Vite inlines `VITE_*` at build time. Setting `.env` fixes local development only — **the production build on Cloudflare Pages needs `VITE_EXTENSION_ID` added to its build environment variables**, or production keeps showing "not installed". This is a manual dashboard step and cannot be done from the repo.

### Explicitly not fixed here

These were found during investigation, are real, and are out of scope for this change:

- `externally_connectable` omits the apex `https://snaprecorder.org/*`, so users on the no-`www` host get a hard `notInstalled`. Fixing it requires an extension release.
- `chrome.runtime.lastError` is never read, logging an unchecked-error warning per page load.
- Detection is single-shot with no retry on focus/visibility, so a sleeping service worker that misses the 1200ms window stays wrong until reload.
- Android Chrome matches the `isChromium` UA regex and is told `notInstalled` rather than `unsupported`.

---

## 2. The "Keep SnapRec free" card

When `status === 'connected'`, `ExtensionNotice` currently renders `null`. Instead it renders a Patreon support card in that slot, so the space the install prompt occupied becomes the support ask once the user has the extension.

- Copy: a heading in the spirit of "Help keep SnapRec free" and one line on hosting costs, with a link to `https://www.patreon.com/cw/SnapRec`.
- Not dismissible. Confirmed in conversation.
- Styled with the same section/card treatment `ExtensionNotice`'s existing three cards use, reading `--sr-*` tokens. Never coral — `capture` and coral marks are reserved for live-capture and needs-response UI.
- Opens in a new tab: `target="_blank" rel="noopener"`.
- Renders only for `'connected'`. `'checking'`, `'notInstalled'`, `'notResponding'`, and `'unsupported'` keep their current behavior.

The Patreon URL is already a named constant in `components/TopBar.tsx`. Both call sites need it, so it moves to a shared module rather than being duplicated — a small `lib/` constant is sufficient; no config or env indirection for a static public URL.

---

## 3. Uniform capture card geometry

### Root cause

`CapturePlate.tsx:56` is a column flex container; its first item is a `CaptureFrame` carrying `aspectRatio: '16 / 9'` (`CapturePlate.tsx:57-60`). `CaptureFrame` renders `<div style={{ position: 'relative', ...style }}>` (`CaptureFrame.tsx:50`) with no `overflow` and no `minHeight`.

The two media branches of `CapturePreview` differ in a way that matters:

- **Recording** (`CapturePreview.tsx:140-172`) — a `position: relative` wrapper whose `img`/`video`/`canvas` children are all `position: absolute; inset: 0`. Absolutely positioned children contribute no content height, so the frame's height comes purely from `aspect-ratio`. These plates are always 16:9.
- **Screenshot** (`CapturePreview.tsx:133-138`) — a bare, in-flow `<img style={fill}>`, where `fill` is `{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }`. Its `height: 100%` cannot resolve against a parent whose block size is still being derived from `aspect-ratio`, so for content-sizing the image falls back to its intrinsic height. As a flex item the frame has `min-height: auto`, and that content-based minimum **wins over `aspect-ratio`** whenever the screenshot is taller than 16:9. `object-fit: cover` never gets the chance to crop.

So recordings are uniform and screenshots inherit the captured image's aspect ratio. Full-page screenshots are the worst case, since `toCaptureKind` (`lib/captureAdapter.ts:18-20`) routes everything non-video into this branch and `capturePreviewUrl` (lines 47-50) serves the untouched full-resolution file.

Width genuinely cannot vary: both grids use `repeat(N, minmax(0, 1fr))` (`pages/Library.tsx:227-231`, `pages/Home.tsx:105-109`), and the `minmax(0, …)` floor stops an oversized image widening a track. The reported "wider" is a side effect of height: the grid sets no `alignItems`, so it defaults to `stretch` and one tall plate raises its entire row, leaving the well-behaved plates with dead space under their captions. A row containing one much-taller card reads as that card being bigger.

### Fix

Two changes, both narrow:

1. In `CapturePreview.tsx:136`, give the screenshot `<img>` the same treatment the recording branch already uses — `{ ...fill, position: 'absolute', inset: 0 }` — so it stops contributing content height. It needs a `position: relative` ancestor, which `CaptureFrame` already provides.
2. On the `CaptureFrame` style in `CapturePlate.tsx:57-60`, add `overflow: 'hidden'` and `minHeight: 0`, so the frame clips its media and its flex content minimum cannot override the aspect ratio. This is belt-and-braces against any future in-flow child.

Result: every plate is exactly 16:9 at every breakpoint, and tall screenshots are center-cropped by `object-fit: cover` as originally intended.

Ruled out with evidence, so not touched: title wrapping (absolutely positioned with `WebkitLineClamp: 2`), the meta line, kind/status chips and the action rail (all absolute or fixed-height), `footnotes` (sits inside the 19px badge row), and global CSS (Tailwind preflight's `img { height: auto }` is already overridden by the inline `height: '100%'`).

---

## 4. Account menu and sign-out

### Current behavior

`AppShell.tsx:98` supplies `onUserMenu={() => navigate('/settings')}` and `AppShell.tsx:84` supplies the same for the rail avatar's `onUserClick`. The TopBar button renders initials plus a `down-outlined` chevron (`TopBar.tsx:149-162`), so it looks like a dropdown trigger while behaving as a link, and it carries no `aria-haspopup`/`aria-expanded`.

There is no sign-out anywhere in the dashboard. `AuthContext` exposes `signOut` (`contexts/AuthContext.tsx:115-121`), but its only dashboard consumer is `Settings.tsx:66`, wired at `Settings.tsx:117` to the field keyed `deleteAccount` — the control labelled "Delete my account and everything in it" with help text "Removes every capture, link and comment. This cannot be undone." That control signs the user out and deletes nothing.

An existing `components/UserMenu.tsx` implements a full avatar dropdown with Settings and Sign Out, but it is Tailwind/`material-symbols` styled, renders its own avatar trigger, and uses a weaker dismiss (no ref containment, no Escape). It is used only by the Video Editor chrome. It is not reused here.

### Design

A new account menu owned by `AppShell`, following the popover pattern `AppShell` already uses for `capturePopover` (state at `AppShell.tsx:51`, anchored in the `position: relative; height: 0` wrapper at lines 101-108).

- **Desktop / tablet:** an anchored popover, `role="menu"`, styled with inline `--sr-*` tokens and `@iconify/react` to match `TopBar`. Contents: an identity header (name and email from `useAuth().user`), a Settings item, a divider, and Sign out.
- **Mobile (`useBreakpoint() === 'mobile'`):** the same items rendered in the existing `BottomSheet` (`components/BottomSheet.tsx`), which supplies the scrim, `role="dialog" aria-modal="true"`, Escape-to-close, and focus handling. Item rows follow `pages/Library/ActionsSheet.tsx:22-54` for the 44px touch target and `data-min-target="44"` convention. This is the codebase's stated intent (`AppShell.tsx:27-29`, `BottomSheet.tsx:9-13`) and it also restores Projects and Settings, which `MOBILE_NAV` drops and nothing currently replaces — so the mobile sheet includes Projects alongside Settings and Sign out.
- **Dismissal:** the canonical effect from `pages/Library/FilterPopover.tsx:50-61` — Escape plus `mousedown` outside a ref'd container, both listeners removed on cleanup. The weaker `UserMenu.tsx:13-20` pattern is not copied.
- **Trigger:** both the TopBar avatar and the rail avatar (`AppShell.tsx:84`) open this menu rather than navigating. The TopBar button gains `aria-haspopup="menu"` and `aria-expanded`.
- **Sign out** calls `useAuth().signOut()` and closes the menu. It does not navigate: `onAuthStateChange` clears the user and `ProtectedRoute` bounces to login, which is the existing contract.

### Settings page correction

Confirmed in conversation: the mis-wired `deleteAccount` field in `pages/Settings/sections.ts:110-118` must stop signing the user out under a delete label. A distinct, plain **Sign out** field is added (not `destructive`), and `Settings.tsx:117` keys `onAction` off the new field key rather than off `deleteAccount`.

Genuine account deletion is **also** being implemented, specified separately in [`2026-08-13-account-deletion-design.md`](./2026-08-13-account-deletion-design.md) — it is a server-side feature requiring a new secret and a migration. The two must not share a control: after both land, Settings has a plain sign-out row *and* a real destructive delete action behind typed confirmation.

### Out of scope

`signOut` does not clear the `guestId`, `guestRecordingIds`, or `auth_return_path` localStorage keys. That is pre-existing and interacts with the guest-claim flow, so it is not changed here.

---

## 5. Magic-link sign-in disabled

Confirmed in conversation: keep the control visible but non-functional, with a note that it is coming soon.

In `pages/Login/SignInPanel.tsx`:

- The email `<input>` (lines 76-90) gets `disabled`.
- The submit button (lines 101-106) gets `disabled`, and its styling reflects the disabled state through tokens rather than a hex literal.
- The explanatory line at 97-99 ("No password. We send a one-time link.") is replaced with copy stating email sign-in is coming soon and to use Google for now.
- `submit` (lines 22-31) must not call `onMagicLink`. With both controls disabled the form cannot submit through the UI, but the guard stays explicit so the handler cannot fire via Enter or a programmatic submit.
- Google OAuth (lines 50-54) is untouched and becomes the only working path.

`onMagicLink` stays in the props contract rather than being removed, so `ReturnToTask.tsx:11` and the existing tests keep compiling and re-enabling is a one-line revert.

### Knock-on that must be handled

`pages/Login/SignInFailed.tsx` (rendered from `AuthCallback.tsx:86`) has states whose copy assumes email sign-in works — `linkUsed` ("Send a new one below"), `wrongBrowser`, the retry button `Send a new link to {email}` (lines 58-60), and `adminBlocked`'s "Use email sign-in" (lines 49-51). With magic link disabled, `adminBlocked` in particular becomes a dead end that tells the user to use the one method that no longer works. Its recovery copy must be updated to point at Google instead. The link-expiry states remain reachable by anyone holding an older emailed link, so their copy stays accurate for that case but must not offer to send a new one.

### Test impact

`pages/__tests__/Login.test.tsx` asserts the removed string at lines 27-31, and lines 33-40 and 42-48 assert magic-link submission behavior. Those cases are rewritten to assert the disabled state and the new copy instead.

---

## Testing strategy

Per item, using the existing Vitest + React Testing Library stack in `apps/web`:

1. **Detection:** unit-test that `detectExtension` returns `checking`-aware results and that the initial hook state is `'checking'`; assert `ExtensionNotice` renders nothing while `'checking'`; assert the 1200ms timer is cleared when the ping resolves first. The real `ping()` and the env read remain hard to test in jsdom — the existing tests cover only the pure function, and that gap is what let this bug ship, so at minimum add a test that a falsy extension ID is distinguishable from a genuine "no extension" answer.
2. **Support card:** assert the Patreon link with correct `href`, `target`, `rel` renders for `'connected'` and for no other status.
3. **Card geometry:** assert the screenshot `<img>` carries `position: absolute` and that the frame style includes `overflow: hidden` and `minHeight: 0`. jsdom does not do layout, so uniform height itself cannot be asserted — it needs a manual browser check across a mix of full-page screenshots, wide screenshots, and recordings in one grid row.
4. **Account menu:** assert the avatar opens the menu rather than navigating; Escape and outside-click close it; Sign out invokes `signOut`; the mobile breakpoint renders the `BottomSheet` variant including Projects. Assert the Settings page no longer labels sign-out as account deletion.
5. **Magic link:** assert the input and button are disabled, the new copy is present, and `onMagicLink` is not called on submit.

## Acceptance criteria

- With the extension installed, the dashboard shows the Patreon support card and never the install prompt; with it absent, the install prompt still appears.
- No wrong-state flash before detection resolves.
- Every capture card in a grid row has the same height, whatever the source image's aspect ratio.
- The avatar opens a menu on both TopBar and rail; it closes on Escape and outside click; mobile gets a bottom sheet that also reaches Projects and Settings.
- Signing out from the menu returns the user to login.
- No control in Settings claims to delete the account while only signing out.
- Magic link is visibly unavailable with an explanation, Google still works, and no failure screen directs the user to email sign-in.
