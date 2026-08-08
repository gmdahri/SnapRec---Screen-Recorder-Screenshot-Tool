# P6 Marketing & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page and its mobile form (M1, M2), and build the five auth surfaces — sign-in, return-to-task, guest-capture claiming, sign-in failure and session expiry (A1–A5) — three of which have no code today.

**Architecture:** The landing page keeps its prerendered React-route shape (SEO depends on it) but replaces the hero with an interactive three-step product demo and a factual comparison table. Auth gains a `returnTo` contract carried through Supabase's OAuth redirect, and a guest-claim flow built on the existing `POST /recordings/claim`. The three sign-in failure cases are distinct states with distinct recovery, not one error page.

**Tech Stack:** React 19, react-helmet-async, Supabase Auth (Google OAuth + magic link), TanStack Query, `@snaprec/design-system`, puppeteer prerender.

## Global Constraints

Inherited verbatim from `2026-08-08-plate-redesign-roadmap.md` § "Global constraints". Every task's requirements implicitly include that section.

Additional, P6-specific:

- **Supabase is the sole auth authority.** The server never issues tokens; it verifies them against Supabase's JWKS. Nothing in this phase mints, signs or refreshes a token.
- **Adding a public route touches four files** — `App.tsx`, `prerender.mjs`, `public/sitemap.xml` + `public/_redirects`, `.github/workflows/indexnow.yml`.
- **The comparison table is factual or it is absent.** Every row carries the vendor's published free-tier limit and the date it was checked.
- **No empty hero.** The landing page opens on the real product, interactive.
- **One CTA, twice** — "Add to Chrome — free" at the top and at the foot, and nowhere in between.
- **Guest captures expire after 7 days.** Every surface that mentions them says so.
- **The pending capture stays visible during sign-in.** Users abandon when they cannot see what they are protecting.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/pages/Landing.tsx` | **Rewritten** — M1 |
| `apps/web/src/pages/Landing/ProductDemo.tsx` | The three-step interactive demo |
| `apps/web/src/pages/Landing/ComparisonTable.tsx` | 12 rows, desktop; 4 rows, mobile |
| `apps/web/src/pages/Landing/Faq.tsx` | The six questions |
| `apps/web/src/pages/Landing/copy.ts` | Every string on the page, one file |
| `apps/web/src/pages/Login.tsx` | **Rewritten** — A1 |
| `apps/web/src/pages/Login/ReturnToTask.tsx` | A2 |
| `apps/web/src/pages/Login/SignInFailed.tsx` | A4 — three cases |
| `apps/web/src/pages/ClaimCaptures.tsx` | A3 — **new** |
| `apps/web/src/pages/SessionExpired.tsx` | A5 — **new** |
| `apps/web/src/lib/returnTo.ts` | The `returnTo` contract, with an open-redirect guard |
| `apps/web/src/hooks/useGuestCaptures.ts` | Guest capture discovery and claiming |

---

## Task 1: The returnTo contract

**Files:**
- Create: `apps/web/src/lib/returnTo.ts`
- Create: `apps/web/src/lib/__tests__/returnTo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function encodeReturnTo(path: string): string;
  export function decodeReturnTo(raw: string | null): string;   // always a safe same-origin path
  export function buildAuthRedirect(origin: string, returnTo: string): string;
  ```

An auth redirect that accepts an arbitrary URL is an open redirect. This is
security-relevant code, so it is pure and tested first.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/returnTo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeReturnTo, decodeReturnTo, buildAuthRedirect } from '../returnTo';

describe('returnTo', () => {
  it('round-trips a same-origin path', () => {
    expect(decodeReturnTo(encodeReturnTo('/v/abc123?t=28'))).toBe('/v/abc123?t=28');
  });

  it('rejects an absolute URL to another origin', () => {
    expect(decodeReturnTo(encodeReturnTo('https://evil.example/steal'))).toBe('/home');
  });

  it('rejects a protocol-relative URL', () => {
    expect(decodeReturnTo(encodeReturnTo('//evil.example/steal'))).toBe('/home');
  });

  it('rejects a javascript: URL', () => {
    expect(decodeReturnTo(encodeReturnTo('javascript:alert(1)'))).toBe('/home');
  });

  it('rejects a backslash-smuggled origin', () => {
    expect(decodeReturnTo(encodeReturnTo('/\\evil.example'))).toBe('/home');
  });

  it('falls back to /home when nothing was passed', () => {
    expect(decodeReturnTo(null)).toBe('/home');
    expect(decodeReturnTo('')).toBe('/home');
  });

  it('survives a malformed encoding rather than throwing', () => {
    expect(decodeReturnTo('%')).toBe('/home');
  });

  it('carries the destination through the auth redirect', () => {
    expect(buildAuthRedirect('https://www.snaprecorder.org', '/v/abc'))
      .toBe('https://www.snaprecorder.org/auth/callback?returnTo=%2Fv%2Fabc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- returnTo`
Expected: FAIL — cannot resolve `../returnTo`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/returnTo.ts`:

```ts
const FALLBACK = '/home';

export function encodeReturnTo(path: string): string {
  return encodeURIComponent(path);
}

/** Always returns a safe, same-origin, absolute path.
 *
 * An auth callback that redirects to an attacker-supplied URL is an open
 * redirect, and this one is reachable by anyone who can craft a link. The guard
 * is deliberately a whitelist — must start with exactly one '/' and no
 * backslash — rather than a blacklist of known-bad prefixes. */
export function decodeReturnTo(raw: string | null): string {
  if (!raw) return FALLBACK;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return FALLBACK;
  }

  if (!decoded.startsWith('/')) return FALLBACK;
  if (decoded.startsWith('//')) return FALLBACK;
  if (decoded.includes('\\')) return FALLBACK;
  if (decoded.includes(':')) return FALLBACK;

  return decoded;
}

export function buildAuthRedirect(origin: string, returnTo: string): string {
  return `${origin}/auth/callback?returnTo=${encodeReturnTo(returnTo)}`;
}
```

> The `includes(':')` check also rejects `/v/abc?t=1:30`. That is acceptable —
> no route in the app carries a colon in a query value, and the alternative is
> parsing enough of the URL grammar to be sure. If a route ever needs one,
> encode it as `%3A` at the call site.

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=apps/web -- returnTo`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): add the returnTo contract with an open-redirect guard"
```

---

## Task 2: The landing page (M1)

**Files:**
- Create: `apps/web/src/pages/Landing/copy.ts`
- Create: `apps/web/src/pages/Landing/ProductDemo.tsx`
- Create: `apps/web/src/pages/Landing/ComparisonTable.tsx`
- Create: `apps/web/src/pages/Landing/Faq.tsx`
- Rewrite: `apps/web/src/pages/Landing.tsx`
- Create: `apps/web/src/pages/Landing/__tests__/Landing.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Landing/__tests__/Landing.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductDemo } from '../ProductDemo';
import { ComparisonTable } from '../ComparisonTable';
import { Faq } from '../Faq';
import { COMPARISON, FAQS, DEMO_STEPS } from '../copy';

describe('the product demo (M1)', () => {
  it('opens on the real product, not an empty hero', async () => {
    render(<ProductDemo />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Capture');
  });

  it('has exactly three steps', () => {
    expect(DEMO_STEPS.map(s => s.label)).toEqual(['Capture', 'Refine', 'Share']);
  });

  it('switches step on click', async () => {
    render(<ProductDemo />);
    await userEvent.click(screen.getByRole('tab', { name: /Refine/ }));
    expect(screen.getByRole('tab', { name: /Refine/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('is reachable by keyboard as a tablist', async () => {
    render(<ProductDemo />);
    screen.getByRole('tab', { name: /Capture/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Refine/ })).toHaveFocus();
  });
});

describe('the comparison table', () => {
  it('carries twelve factual rows', () => {
    expect(COMPARISON).toHaveLength(12);
  });

  it('names the source and the date it was checked', () => {
    render(<ComparisonTable rows={COMPARISON} />);
    expect(screen.getByText(/as published by each vendor, checked Aug 2026/)).toBeInTheDocument();
  });

  it('does not claim a competitor has a watermark when it does not', () => {
    const watermark = COMPARISON.find(r => r.row === 'Watermark')!;
    expect([watermark.snap, watermark.loom, watermark.cast]).toEqual(['None', 'None', 'None']);
  });

  it('is a real table with headers, not a grid of divs', () => {
    render(<ComparisonTable rows={COMPARISON} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['', 'SnapRec', 'Loom', 'Screencastify']);
  });
});

describe('the FAQ', () => {
  it('answers the six questions people ask first', () => {
    expect(FAQS).toHaveLength(6);
    expect(FAQS[0].q).toBe('Do I need an account?');
  });

  it('opens one answer at a time and toggles it closed', async () => {
    render(<Faq faqs={FAQS} />);
    const first = screen.getByRole('button', { name: /Do I need an account/ });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('says recording works without an account', () => {
    render(<Faq faqs={FAQS} />);
    expect(screen.getByText(/Recording, screenshots, annotation and downloading all work without signing in/))
      .toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- Landing`
Expected: FAIL — cannot resolve `../copy`.

- [ ] **Step 3: Write copy.ts**

Every string on the page in one file, verbatim from scene M1. The three demo
steps:

```ts
export const DEMO_STEPS = [
  { key: 'capture', label: 'Capture',
    body: 'Record a tab, window or whole screen, or take a visible-area, region or full-page screenshot. Starts in one click from the toolbar.' },
  { key: 'refine', label: 'Refine',
    body: 'Trim the dead air, speed up the slow parts, let auto-zoom follow your clicks. On screenshots: arrows, text, numbered steps, blur or redact.' },
  { key: 'share', label: 'Share',
    body: 'Upload to get a link, or keep it local and download the file. Comments come back on the timeline or pinned to the exact spot on the image.' },
] as const;
```

The twelve comparison rows and six FAQs likewise — take them verbatim from the
prototype. The footnote reads: *"Free-tier limits as published by each vendor,
checked Aug 2026."*

> **Before shipping:** re-verify all 36 competitor cells against Loom's and
> Screencastify's current published free-tier pages, and update the date. A
> comparison table that is wrong is worse than none — and this one names
> competitors, so it is the page most likely to draw a complaint.

- [ ] **Step 4: Write the three components**

`ProductDemo` — a `role="tablist"` of three steps with roving `ArrowLeft` /
`ArrowRight` focus, each showing a real interface still. Defaults to Capture.

`ComparisonTable` — a real `<table>` with a `<caption>` and four
`<th scope="col">`. Mobile drops to four rows and two columns with Screencastify
behind a link to the desktop table.

`Faq` — a disclosure list; the first answer is open by default. Each button
carries `aria-expanded` and `aria-controls`.

- [ ] **Step 5: Rewrite Landing.tsx**

Section order: hero with the live demo → screenshot modes → recording modes →
comparison → FAQ → closing CTA. One CTA at the top, one at the foot, none
between. Keep `<SEO>` — the prerenderer captures its tags.

- [ ] **Step 6: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build:prerender --workspace=apps/web
git add apps/web/src/pages
git commit -m "feat(web): rebuild the landing page around an interactive demo"
```

---

## Task 3: The landing page at 390px (M2)

**Files:**
- Modify: `apps/web/src/pages/Landing.tsx`, `ComparisonTable.tsx`, `ProductDemo.tsx`
- Modify: `apps/web/src/pages/Landing/__tests__/Landing.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/pages/Landing/__tests__/Landing.test.tsx`:

```tsx
import { MobileHero } from '../MobileHero';

describe('the landing page at 390px (M2)', () => {
  it('hides recording controls rather than disabling them', () => {
    render(<MobileHero />);
    expect(screen.queryByRole('button', { name: /Start recording/ })).toBeNull();
    expect(screen.queryByRole('button', { disabled: true })).toBeNull();
  });

  it('explains where recording actually happens', () => {
    render(<MobileHero />);
    expect(screen.getByText(/Recording happens in desktop Chrome/)).toBeInTheDocument();
    expect(screen.getByText(/On phones you can watch, comment on and manage anything already captured/))
      .toBeInTheDocument();
  });

  it('puts the email-me-the-link path beside the Chrome button, not below the fold', () => {
    render(<MobileHero />);
    const cta = screen.getByTestId('mobile-cta');
    expect(within(cta).getByRole('button', { name: /Add to Chrome/ })).toBeInTheDocument();
    expect(within(cta).getByRole('button', { name: /Email me the link/ })).toBeInTheDocument();
  });

  it('makes every primary action full-width and at least 48px', () => {
    render(<MobileHero />);
    for (const b of screen.getAllByRole('button')) {
      expect(Number(b.dataset.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });

  it('drops the demo to a still with a play affordance and no autoplay', () => {
    render(<MobileHero />);
    const media = screen.getByTestId('mobile-demo');
    expect(media.querySelector('video')).toBeNull();
    expect(screen.getByRole('button', { name: /Play/ })).toBeInTheDocument();
  });

  it('shows two comparison columns and links to the full table', () => {
    render(<ComparisonTable rows={COMPARISON} mobile />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByText(/Full table on desktop/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- Landing`
Expected: FAIL — cannot resolve `../MobileHero`.

- [ ] **Step 3: Implement**

The rules, verbatim from the prototype's notes:

- Recording controls are **hidden, not disabled** — a disabled record button on a
  phone reads as a broken product.
- The comparison drops to two columns; Screencastify moves behind a link.
- The demo becomes a single still with a play affordance. **No autoplay on
  cellular.**
- Primary actions are full-width at 48px.
- The email-me-the-link path is the real mobile conversion, so it sits *beside*
  the Chrome button, not below the fold.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build:prerender --workspace=apps/web
git add apps/web/src/pages
git commit -m "feat(web): add the 390px landing page"
```

---

## Task 4: Sign in (A1)

**Files:**
- Rewrite: `apps/web/src/pages/Login.tsx`
- Modify: `apps/web/src/components/GoogleSignInButton.tsx`
- Create: `apps/web/src/pages/__tests__/Login.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/__tests__/Login.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignInPanel } from '../Login';

const mount = (props = {}) => render(
  <MemoryRouter>
    <SignInPanel onGoogle={() => {}} onMagicLink={() => {}} {...props} />
  </MemoryRouter>,
);

describe('sign in (A1)', () => {
  it('says what an account adds rather than what it gates', () => {
    mount();
    expect(screen.getByText(/keeps your captures in one library, lets you rename links, and shows you who watched/))
      .toBeInTheDocument();
  });

  it('promises that existing recordings survive signing in', () => {
    mount();
    expect(screen.getByText('Nothing you have already recorded is lost by signing in.')).toBeInTheDocument();
  });

  it('offers Google and a one-time link, and says the link is passwordless', () => {
    mount();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByText('No password. We send a one-time link.')).toBeInTheDocument();
  });

  it('validates the email before sending', async () => {
    const onMagicLink = vi.fn();
    mount({ onMagicLink });
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /Send.*link/i }));
    expect(onMagicLink).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('sends the link for a valid address', async () => {
    const onMagicLink = vi.fn();
    mount({ onMagicLink });
    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'maya@northlight.co');
    await userEvent.click(screen.getByRole('button', { name: /Send.*link/i }));
    expect(onMagicLink).toHaveBeenCalledWith('maya@northlight.co');
  });

  it('links the terms rather than burying them', () => {
    mount();
    expect(screen.getByRole('link', { name: /Terms/ })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/ })).toHaveAttribute('href', '/privacy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- Login`
Expected: FAIL — `SignInPanel` is not exported from `../Login`.

- [ ] **Step 3: Implement**

Export `SignInPanel` as a presentational component so it can be reused by A2 and
A5. `Login.tsx` wires it to Supabase, passing `buildAuthRedirect(origin, returnTo)`
as `emailRedirectTo` / `redirectTo`.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build --workspace=apps/web
git add apps/web/src
git commit -m "feat(web): rebuild sign-in"
```

---

## Task 5: Return to task (A2)

**Files:**
- Create: `apps/web/src/pages/Login/ReturnToTask.tsx`
- Modify: `apps/web/src/pages/AuthCallback.tsx`
- Modify: `apps/web/src/pages/__tests__/Login.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/pages/__tests__/Login.test.tsx`:

```tsx
import { ReturnToTask } from '../Login/ReturnToTask';

describe('return to task (A2)', () => {
  const pending = { title: 'Sprint demo walkthrough', meta: '2:14 · recorded 8 min ago',
    kind: 'recording' as const, expiresInDays: 7 };

  it('keeps the pending capture visible throughout', () => {
    render(<MemoryRouter><ReturnToTask pending={pending} returnTo="/v/abc" onGoogle={() => {}} onMagicLink={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Sprint demo walkthrough')).toBeInTheDocument();
    expect(screen.getByText('2:14 · recorded 8 min ago')).toBeInTheDocument();
  });

  it('says where the user will land afterwards', () => {
    render(<MemoryRouter><ReturnToTask pending={pending} returnTo="/v/abc" onGoogle={() => {}} onMagicLink={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Sign in and we'll take you back here")).toBeInTheDocument();
  });

  it('keeps sharing without an account available, and honest about expiry', () => {
    render(<MemoryRouter><ReturnToTask pending={pending} returnTo="/v/abc" onGoogle={() => {}} onMagicLink={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Share without an account/ })).toBeInTheDocument();
    expect(screen.getByText(/expires in 7 days/)).toBeInTheDocument();
  });

  it('never suggests the recording is at risk', () => {
    render(<MemoryRouter><ReturnToTask pending={pending} returnTo="/v/abc" onGoogle={() => {}} onMagicLink={() => {}} /></MemoryRouter>);
    const text = document.body.textContent!.toLowerCase();
    expect(text).not.toContain('lose');
    expect(text).not.toContain('will be deleted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- Login`
Expected: FAIL.

- [ ] **Step 3: Implement**

`ReturnToTask` composes `SignInPanel` with a pending-capture plate above it.

In `AuthCallback.tsx`, read `returnTo` from the query with `decodeReturnTo` and
navigate there rather than to `/home`. The recording stays in local storage until
upload confirms, so a failed sign-in never destroys it — assert this by leaving
the local-storage write untouched on the failure path.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build --workspace=apps/web
git add apps/web/src/pages
git commit -m "feat(web): return the user to their task after signing in"
```

---

## Task 6: Claim guest captures (A3)

**Files:**
- Create: `apps/web/src/hooks/useGuestCaptures.ts`
- Create: `apps/web/src/pages/ClaimCaptures.tsx`
- Create: `apps/web/src/pages/__tests__/ClaimCaptures.test.tsx`
- Modify: `apps/server/src/recordings/dto/claim-recordings.dto.ts`
- Modify: `apps/server/src/recordings/recordings.service.ts`
- Create: `apps/server/src/recordings/__tests__/claim.spec.ts`

**Interfaces:**
- Produces:
  - `POST /recordings/claim` accepting `{ guestId: string; recordingIds?: string[] }` — a **partial** claim
  - `<ClaimCaptures />` on `/claim`

- [ ] **Step 1: Write the failing server test**

Create `apps/server/src/recordings/__tests__/claim.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ClaimRecordingsDto } from '../dto/claim-recordings.dto';

const dto = (o: Record<string, unknown>) => plainToInstance(ClaimRecordingsDto, o);

describe('claiming guest captures', () => {
  it('accepts a whole-guest claim', async () => {
    expect(await validate(dto({ guestId: 'g-123' }))).toHaveLength(0);
  });

  it('accepts a partial claim by id', async () => {
    expect(await validate(dto({ guestId: 'g-123', recordingIds: ['a', 'b'] }))).toHaveLength(0);
  });

  it('rejects a claim with no guest id', async () => {
    expect(await validate(dto({ recordingIds: ['a'] }))).not.toHaveLength(0);
  });

  it('rejects a non-array recordingIds', async () => {
    expect(await validate(dto({ guestId: 'g-123', recordingIds: 'a' }))).not.toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/recordings/__tests__/claim.spec.ts` (from `apps/server`)
Expected: FAIL — `recordingIds` is rejected by `forbidNonWhitelisted`.

- [ ] **Step 3: Extend the DTO and service**

```ts
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class ClaimRecordingsDto {
  @IsString()
  guestId: string;

  /** Absent means claim everything this guest owns. Present means claim only
   * these — the user chose in the UI, and unclaimed captures stay on the device
   * for the remainder of their 7 days. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  recordingIds?: string[];
}
```

In `recordings.service.ts`, scope the `UPDATE` by `guestId` **and** — when
present — by `id IN (:...ids)`. Never trust the id list alone: a caller who
guesses another guest's recording id must not be able to claim it.

- [ ] **Step 4: Write the failing web test**

Create `apps/web/src/pages/__tests__/ClaimCaptures.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimPanel } from '../ClaimCaptures';

const captures = [
  { id: 'c1', title: 'Sprint demo walkthrough', meta: '2:14 · recorded 8 min ago', kind: 'recording' as const },
  { id: 'c2', title: 'Checkout bug — step 3', meta: '0:41 · recorded 2 h ago', kind: 'recording' as const },
  { id: 'c3', title: 'Pricing table markup', meta: 'Screenshot · yesterday', kind: 'screenshot' as const },
];

const mount = (onClaim = vi.fn()) =>
  render(<ClaimPanel captures={captures} email="maya@northlight.co" onClaim={onClaim} onSkip={() => {}} />);

describe('claim guest captures (A3)', () => {
  it('names who is signed in', () => {
    mount();
    expect(screen.getByText(/Signed in as maya@northlight.co/)).toBeInTheDocument();
  });

  it('selects everything by default — the common case is claim all', () => {
    mount();
    for (const c of screen.getAllByRole('checkbox')) expect(c).toBeChecked();
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
  });

  it('lets individual captures be deselected', async () => {
    mount();
    await userEvent.click(screen.getByRole('checkbox', { name: /Pricing table markup/ }));
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
  });

  it('says exactly what happens to what is skipped', () => {
    mount();
    expect(screen.getByText(/stays on this device for 7 days and then expires/)).toBeInTheDocument();
    expect(screen.getByText(/You can claim it later from the extension/)).toBeInTheDocument();
  });

  it('claims only the selected ids', async () => {
    const onClaim = vi.fn();
    mount(onClaim);
    await userEvent.click(screen.getByRole('checkbox', { name: /Pricing table markup/ }));
    await userEvent.click(screen.getByRole('button', { name: /Move.*to my library/ }));
    expect(onClaim).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('disables the primary action when nothing is selected', async () => {
    mount();
    for (const c of screen.getAllByRole('checkbox')) await userEvent.click(c);
    expect(screen.getByRole('button', { name: /Move.*to my library/ })).toBeDisabled();
  });
});
```

- [ ] **Step 5: Implement the page**

`ClaimPanel` is presentational; `ClaimCaptures` wires it to `useGuestCaptures`
(which reads the local `guestId` and fetches that guest's recordings) and to the
claim mutation. After a successful claim, navigate to `decodeReturnTo(...)` or
`/library`.

Entry points: the H2 new-user block from P3 Task 4, and the post-sign-in callback
when guest captures exist.

- [ ] **Step 6: Run everything and commit**

```bash
npm run test --workspace=apps/web
npm test --workspace=apps/server
npm run build --workspace=apps/web
git add apps/web/src apps/server/src
git commit -m "feat: add guest capture claiming"
```

---

## Task 7: Sign-in failure and session expiry (A4, A5)

**Files:**
- Create: `apps/web/src/pages/Login/SignInFailed.tsx`
- Create: `apps/web/src/pages/SessionExpired.tsx`
- Create: `apps/web/src/pages/__tests__/authFailures.test.tsx`
- Modify: `apps/web/src/pages/AuthCallback.tsx`, `apps/web/src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type SignInFailure = 'linkUsed' | 'wrongBrowser' | 'networkDropped' | 'adminBlocked';
  <SignInFailed kind={SignInFailure} email?={string} onRetry onGoogle />
  <SessionExpired email={string} unsavedWork?={{ title: string; kind: string }} onSignIn />
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/__tests__/authFailures.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInFailed } from '../Login/SignInFailed';
import { SessionExpired } from '../SessionExpired';

const failed = (kind: 'linkUsed' | 'wrongBrowser' | 'networkDropped' | 'adminBlocked') =>
  render(<MemoryRouter><SignInFailed kind={kind} email="maya@northlight.co"
    onRetry={() => {}} onGoogle={() => {}} /></MemoryRouter>);

describe('sign-in failure (A4)', () => {
  it('explains a used link and its lifetime', () => {
    failed('linkUsed');
    expect(screen.getByRole('heading', { name: 'That link has already been used' })).toBeInTheDocument();
    expect(screen.getByText('Sign-in links work once and expire after 15 minutes. Send a new one below.'))
      .toBeInTheDocument();
  });

  it('tells a wrong-browser user which browser to use', () => {
    failed('wrongBrowser');
    expect(screen.getByText(/Open the link in the same browser you requested it from/)).toBeInTheDocument();
  });

  it('says nothing was sent when the network dropped', () => {
    failed('networkDropped');
    expect(screen.getByText(/nothing was sent/)).toBeInTheDocument();
  });

  it('gives an admin-blocked user two real routes', () => {
    failed('adminBlocked');
    expect(screen.getByText(/Your workspace admin has not approved SnapRec/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email sign-in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approval link/i })).toBeInTheDocument();
  });

  it('always offers a way forward', () => {
    for (const k of ['linkUsed', 'wrongBrowser', 'networkDropped', 'adminBlocked'] as const) {
      const { unmount } = failed(k);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('never apologises or names an internal error', () => {
    for (const k of ['linkUsed', 'wrongBrowser', 'networkDropped', 'adminBlocked'] as const) {
      const { unmount } = failed(k);
      const text = document.body.textContent!.toLowerCase();
      expect(text).not.toContain('sorry');
      expect(text).not.toContain('oauth');
      expect(text).not.toMatch(/error \d/);
      unmount();
    }
  });
});

describe('session expiry (A5)', () => {
  it('says how long the session lasted and who to sign back in as', () => {
    render(<MemoryRouter><SessionExpired email="maya@northlight.co" onSignIn={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/signed out after 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/maya@northlight.co/)).toBeInTheDocument();
  });

  it('names unsaved work rather than losing it silently', () => {
    render(<MemoryRouter><SessionExpired email="maya@northlight.co"
      unsavedWork={{ title: 'Follow-up for Brightline demo', kind: 'edit' }} onSignIn={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/One unsaved edit to/)).toBeInTheDocument();
    expect(screen.getByText(/Follow-up for Brightline demo/)).toBeInTheDocument();
  });

  it('says nothing about unsaved work when there is none', () => {
    render(<MemoryRouter><SessionExpired email="maya@northlight.co" onSignIn={() => {}} /></MemoryRouter>);
    expect(screen.queryByText(/unsaved/)).toBeNull();
  });

  it('is not an error — no coral', () => {
    const { container } = render(<MemoryRouter><SessionExpired email="m@x.co" onSignIn={() => {}} /></MemoryRouter>);
    expect(container.innerHTML).not.toContain('coral');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- authFailures`
Expected: FAIL.

- [ ] **Step 3: Implement**

`SignInFailed` — one component, four cases, each with its own heading, body and
actions. Copy verbatim from scenes A4 and the failures list in file 01.

`SessionExpired` — the heading "Your session expired", the body naming the 30-day
window and the account, an optional unsaved-work line, and a sign-in action. No
coral; nothing has broken.

Wire both: `AuthCallback` maps Supabase's error codes to a `SignInFailure` and
renders `SignInFailed`; `AuthContext` renders `SessionExpired` when a refresh
fails on a previously-authenticated session rather than bouncing to `/login`.

> Supabase's error surface is not stable across versions. Map defensively:
> anything unrecognised falls through to `networkDropped`, which is the only
> case whose copy is true regardless of cause.

- [ ] **Step 4: Register the routes**

`/claim` and `/session-expired` are auth-adjacent and must **not** be prerendered
or listed in the sitemap. Add them to `App.tsx` only, and to the exclusion list
in the P3 Task 14 route test with a comment.

- [ ] **Step 5: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build:prerender --workspace=apps/web
git add apps/web/src
git commit -m "feat(web): add sign-in failure and session expiry states"
```

---

## Task 8: SEO and end-to-end verification

**Files:**
- Modify: `apps/web/prerender.mjs`, `public/sitemap.xml`, `public/_redirects`, `.github/workflows/indexnow.yml`
- Modify: `apps/web/src/components/SEO.tsx`

- [ ] **Step 1: Run the route gate**

Run: `npm run test --workspace=apps/web -- routes`
Fix anything it names. Landing is the only public route this phase changes, but
its meta description changed, so check `SEO.tsx` picks up the new copy.

- [ ] **Step 2: Verify the prerender output**

```bash
npm run build:prerender --workspace=apps/web
grep -c "Make it clear" apps/web/dist/index.html
```

Expected: at least 1. If it is 0, the hero renders client-side only and the page
ships with an empty body to crawlers.

- [ ] **Step 3: Walk every auth path by hand**

1. Sign in with Google from `/login` → lands on `/home`.
2. Open a share link logged out, hit sign in → lands back on the share link.
3. Record as a guest, sign in → the claim page lists the guest captures;
   deselect one, claim; the deselected one is still on the device.
4. Open a magic link twice → the second shows `linkUsed`, not a blank page.
5. Open a magic link in a different browser → `wrongBrowser`.
6. Clear the Supabase session while the app is open → `SessionExpired`, and
   signing back in returns to the same page.
7. Craft `/auth/callback?returnTo=https://example.com` → lands on `/home`,
   **not** on example.com.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify marketing and auth end to end"
```

---

## Exit criteria

- `npm run test --workspace=apps/web` and `npm test --workspace=apps/server` pass.
- `npm run build:prerender --workspace=apps/web` succeeds and the landing hero
  appears in the prerendered HTML.
- All five auth surfaces (A1–A5) are reachable and recoverable.
- Guest claiming works end to end, including a partial claim.
- The open-redirect guard rejects an off-origin `returnTo` in a live browser,
  not only in the unit test.
- The comparison table's 36 competitor cells have been re-verified against the
  vendors' published pages, and the footnote date matches the day it was checked.
