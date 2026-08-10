# P4 Share & Viewer Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public share page as two distinct comment-anchoring models — timecode for video (C1), coordinate point for screenshots (C2) — with their mobile forms (C3, C4) and the two no-media states (C5 private, C6 processing).

**Architecture:** `ShareView.tsx` splits into a shell plus four bodies chosen by media type and breakpoint. The two anchoring models are genuinely different data shapes, not one model with a nullable field: a video comment owns a `timecodeMs`, an image comment owns a normalised `{ x, y }`. The server already accepts either a `userId` or a `guestId` on comments and must keep doing so — this page is the product's main logged-out surface.

**Tech Stack:** React 19, TanStack Query, `@snaprec/design-system`, the existing `VideoPlayer`, NestJS + TypeORM for the comment anchor migration.

## Global Constraints

Inherited verbatim from `2026-08-08-plate-redesign-roadmap.md` § "Global constraints". Every task's requirements implicitly include that section.

Additional, P4-specific:

- **This page is the product's front door for people who have never heard of it.** No promotion appears on it except in C5, where there is no media to look at.
- **Media dominates.** Product chrome is a 52px bar and a 72px metadata margin. No sidebar, no cards, no upsell.
- **The frame is passive.** Two registration marks, no handles — nothing on a share page is resizable.
- **Anonymous callers must work everywhere.** `OptionalJwtAuthGuard`, `guestId`, and every mutation accepting either identity.
- **Leaders are conditional**: hairline leaders from pin to note are drawn only when the margin is ≥300px. Below that they are dropped entirely, and selection replaces connection.
- **Coral appears only on `needs a reply`.** Neither C5 nor C6 uses it — nothing has broken.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/pages/ShareView.tsx` | Shell: header bar, metadata margin, body selection |
| `apps/web/src/pages/Share/VideoShare.tsx` | C1 — timecode anchoring |
| `apps/web/src/pages/Share/ImageShare.tsx` | C2 — coordinate anchoring |
| `apps/web/src/pages/Share/MobileVideoShare.tsx` | C3 — pinned media, comment sheet |
| `apps/web/src/pages/Share/MobileImageShare.tsx` | C4 — no leaders, selection pairing |
| `apps/web/src/pages/Share/PrivateCapture.tsx` | C5 |
| `apps/web/src/pages/Share/ProcessingCapture.tsx` | C6 |
| `apps/web/src/pages/Share/anchors.ts` | The two anchor models and their layout maths |
| `apps/web/src/pages/Share/CommentComposer.tsx` | Shared composer, guest-aware |
| `apps/server/src/recordings/entities/comment.entity.ts` | `anchorX`, `anchorY` columns |
| `apps/server/src/migrations/*-AddCommentAnchors.ts` | The migration |

---

## Task 1: The anchor models

**Files:**
- Create: `apps/web/src/pages/Share/anchors.ts`
- Create: `apps/web/src/pages/Share/__tests__/anchors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TimecodeAnchor { kind: 'timecode'; ms: number }
  export interface PointAnchor { kind: 'point'; x: number; y: number }   // 0–1 normalised
  export type Anchor = TimecodeAnchor | PointAnchor;

  export interface ShareComment {
    id: string; author: string; body: string; createdAt: string;
    anchor: Anchor; needsReply: boolean; resolved: boolean; index: number;
  }

  export function columnPositions(comments: ShareComment[], durationMs: number, widthPx: number)
    : { id: string; leftPct: number; columnIndex: number }[];
  export function leadersVisible(marginPx: number): boolean;
  export function pinScreenPosition(a: PointAnchor, box: { w: number; h: number }): { left: number; top: number };
  export function renumber(comments: ShareComment[]): ShareComment[];
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Share/__tests__/anchors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { columnPositions, leadersVisible, pinScreenPosition, renumber } from '../anchors';

const at = (id: string, ms: number, index: number) => ({
  id, author: 'A', body: 'b', createdAt: '', index,
  anchor: { kind: 'timecode' as const, ms }, needsReply: false, resolved: false,
});

describe('timecode anchoring (C1)', () => {
  it('places each comment column at its timecode position under the media', () => {
    const cols = columnPositions([at('a', 11_000, 1), at('b', 28_000, 2)], 47_000, 900);
    expect(cols[0].leftPct).toBeCloseTo(23.4, 1);
    expect(cols[1].leftPct).toBeCloseTo(59.6, 1);
  });

  it('never places a column outside the track', () => {
    const cols = columnPositions([at('a', 0, 1), at('b', 47_000, 2)], 47_000, 900);
    expect(cols[0].leftPct).toBe(0);
    expect(cols[1].leftPct).toBe(100);
  });

  it('assigns distinct column indices so overlapping timecodes do not stack', () => {
    const cols = columnPositions([at('a', 10_000, 1), at('b', 10_400, 2), at('c', 40_000, 3)], 47_000, 900);
    expect(cols[0].columnIndex).not.toBe(cols[1].columnIndex);
    expect(cols[2].columnIndex).toBe(0);
  });
});

describe('point anchoring (C2)', () => {
  it('converts a normalised anchor to a pixel position', () => {
    expect(pinScreenPosition({ kind: 'point', x: 0.25, y: 0.5 }, { w: 800, h: 600 }))
      .toEqual({ left: 200, top: 300 });
  });

  it('draws leaders only when the margin can hold them', () => {
    expect(leadersVisible(300)).toBe(true);
    expect(leadersVisible(299)).toBe(false);
    expect(leadersVisible(0)).toBe(false);
  });
});

describe('numbering', () => {
  it('renumbers in document order so numbers survive a deletion', () => {
    const list = [at('a', 5, 1), at('b', 10, 2), at('c', 15, 3)];
    const after = renumber(list.filter(c => c.id !== 'b'));
    expect(after.map(c => c.index)).toEqual([1, 2]);
  });

  it('keeps numbers stable for unchanged comments', () => {
    const list = [at('a', 5, 1), at('b', 10, 2)];
    expect(renumber(list).map(c => c.index)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- anchors`
Expected: FAIL — cannot resolve `../anchors`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/pages/Share/anchors.ts`:

```ts
/** Two anchoring models, deliberately not unified.
 *
 * A video comment attaches to a moment; an image comment attaches to a place.
 * Collapsing them into one shape with a nullable field would make every call
 * site ask "which kind is this?" anyway, and would let a video comment carry
 * meaningless coordinates. */

export interface TimecodeAnchor { kind: 'timecode'; ms: number }
export interface PointAnchor { kind: 'point'; x: number; y: number }
export type Anchor = TimecodeAnchor | PointAnchor;

export interface ShareComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  anchor: Anchor;
  needsReply: boolean;
  resolved: boolean;
  index: number;
}

/** Minimum horizontal separation before two columns are treated as colliding. */
const COLLISION_PCT = 8;

/** Each column starts at its timecode's horizontal position under the media, so
 * the conversation is legible as a shape before it is read. */
export function columnPositions(comments: ShareComment[], durationMs: number, _widthPx: number) {
  const timed = comments
    .filter((c): c is ShareComment & { anchor: TimecodeAnchor } => c.anchor.kind === 'timecode')
    .sort((a, b) => a.anchor.ms - b.anchor.ms);

  const placed: { id: string; leftPct: number; columnIndex: number }[] = [];

  for (const c of timed) {
    const leftPct = durationMs === 0 ? 0 : Math.min(100, Math.max(0, (c.anchor.ms / durationMs) * 100));
    const colliding = placed.filter(p => Math.abs(p.leftPct - leftPct) < COLLISION_PCT);
    const taken = new Set(colliding.map(p => p.columnIndex));
    let columnIndex = 0;
    while (taken.has(columnIndex)) columnIndex += 1;
    placed.push({ id: c.id, leftPct, columnIndex });
  }

  return placed;
}

/** Leaders are drawn only when the margin is at least 300px wide. Below that —
 * tablet portrait and mobile — they are dropped entirely and selection replaces
 * connection. */
export function leadersVisible(marginPx: number): boolean {
  return marginPx >= 300;
}

export function pinScreenPosition(a: PointAnchor, box: { w: number; h: number }) {
  return { left: a.x * box.w, top: a.y * box.h };
}

/** Numbers make pins distinguishable without colour, so they must never have
 * gaps. Renumber on every change rather than storing an index. */
export function renumber(comments: ShareComment[]): ShareComment[] {
  return comments.map((c, i) => ({ ...c, index: i + 1 }));
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test --workspace=apps/web -- anchors`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Share
git commit -m "feat(web): add the two share-comment anchor models"
```

---

## Task 2: Persist point anchors

**Files:**
- Modify: `apps/server/src/recordings/entities/comment.entity.ts`
- Modify: `apps/server/src/recordings/dto/create-comment.dto.ts`
- Create: `apps/server/src/migrations/<timestamp>-AddCommentAnchors.ts`
- Modify: `apps/server/src/app.module.ts`, `apps/server/src/data-source.ts` — **verify only**, the entity is already registered
- Create: `apps/server/src/recordings/__tests__/comment-anchor.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/recordings/__tests__/comment-anchor.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCommentDto } from '../dto/create-comment.dto';

const dto = (o: Record<string, unknown>) => plainToInstance(CreateCommentDto, o);

describe('comment anchors', () => {
  it('accepts a timecode anchor', async () => {
    expect(await validate(dto({ body: 'hi', timecodeMs: 11_000 }))).toHaveLength(0);
  });

  it('accepts a normalised point anchor', async () => {
    expect(await validate(dto({ body: 'hi', anchorX: 0.25, anchorY: 0.5 }))).toHaveLength(0);
  });

  it('rejects a point outside the image', async () => {
    expect(await validate(dto({ body: 'hi', anchorX: 1.4, anchorY: 0.5 }))).not.toHaveLength(0);
  });

  it('accepts a comment with no anchor at all', async () => {
    expect(await validate(dto({ body: 'hi' }))).toHaveLength(0);
  });

  it('still accepts a guestId — this page must work logged out', async () => {
    expect(await validate(dto({ body: 'hi', guestId: 'g-123' }))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/recordings/__tests__/comment-anchor.spec.ts` (from `apps/server`)
Expected: FAIL — `anchorX` is rejected by `forbidNonWhitelisted`.

- [ ] **Step 3: Extend the DTO**

In `apps/server/src/recordings/dto/create-comment.dto.ts`:

```ts
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

// … existing fields …

  /** Normalised horizontal position on the image, 0–1. Screenshot comments only. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anchorX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anchorY?: number;
```

> Store the anchor normalised, not in pixels. The same screenshot is rendered at
> different widths on desktop, tablet and mobile, and pins must land on the same
> feature at every size.

- [ ] **Step 4: Extend the entity**

In `comment.entity.ts`:

```ts
@Column({ type: 'double precision', nullable: true })
anchorX: number | null;

@Column({ type: 'double precision', nullable: true })
anchorY: number | null;
```

- [ ] **Step 5: Generate and apply the migration**

```bash
cd apps/server
npm run migration:generate -- src/migrations/AddCommentAnchors
npm run migration:run
```

Read the generated file before running it. `synchronize` is `false` everywhere;
never edit a migration once applied.

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace=apps/server`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): persist normalised point anchors on comments"
```

---

## Task 3: The share shell and video body (C1)

**Files:**
- Rewrite: `apps/web/src/pages/ShareView.tsx`
- Create: `apps/web/src/pages/Share/VideoShare.tsx`
- Create: `apps/web/src/pages/Share/CommentComposer.tsx`
- Create: `apps/web/src/pages/Share/__tests__/VideoShare.test.tsx`

**Interfaces:**
- Consumes: `anchors.ts` (Task 1); `CaptureFrame`, `StatusBadge`; `VideoPlayer`; `useBreakpoint`.
- Produces: `<VideoShare capture comments onSeek onPost />`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Share/__tests__/VideoShare.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoShare } from '../VideoShare';

const capture = { id: 'c1', title: 'Checkout bug repro', owner: 'Priya Raman',
  durationMs: 47_000, streamUrl: 'blob:x', allowDownload: true };

const comments = [
  { id: '1', author: 'Dan Keller', body: 'Repros for me', createdAt: '', index: 1,
    anchor: { kind: 'timecode' as const, ms: 11_000 }, needsReply: false, resolved: false },
  { id: '2', author: 'Maya Osei', body: 'Only on Safari?', createdAt: '', index: 2,
    anchor: { kind: 'timecode' as const, ms: 28_000 }, needsReply: false, resolved: false },
  { id: '3', author: 'Sam Ortiz', body: 'What build is this?', createdAt: '', index: 3,
    anchor: { kind: 'timecode' as const, ms: 39_000 }, needsReply: true, resolved: false },
];

describe('video share (C1)', () => {
  it('seeks when a timeline marker is clicked', async () => {
    const onSeek = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={onSeek} onPost={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Comment at 0:28' }));
    expect(onSeek).toHaveBeenCalledWith(28_000);
  });

  it('seeks when the comment itself is clicked', async () => {
    const onSeek = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={onSeek} onPost={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Comment 1 from Dan Keller/ }));
    expect(onSeek).toHaveBeenCalledWith(11_000);
  });

  it('marks the one comment awaiting a reply in coral and in words', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.getByLabelText(/Comment 3 from Sam Ortiz, needs a reply/)).toBeInTheDocument();
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('uses a passive frame — nothing on a share page is resizable', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.queryAllByTestId('handle')).toHaveLength(0);
  });

  it('carries no promotion', () => {
    render(<VideoShare capture={capture} comments={comments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.queryByText(/What is SnapRec/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Add to Chrome/ })).toBeNull();
  });

  it('lets an anonymous viewer comment', async () => {
    const onPost = vi.fn();
    render(<VideoShare capture={capture} comments={comments} onSeek={() => {}} onPost={onPost} />);
    await userEvent.type(screen.getByRole('textbox', { name: /comment/i }), 'Same here');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ body: 'Same here' }));
  });

  it('hides download when the owner disallowed it', () => {
    render(<VideoShare capture={{ ...capture, allowDownload: false }} comments={[]}
      onSeek={() => {}} onPost={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- VideoShare`
Expected: FAIL — cannot resolve `../VideoShare`.

- [ ] **Step 3: Write CommentComposer**

A labelled `<textarea>` (`aria-label="Write a comment"`), a name field shown only
to anonymous viewers, and a "Post comment" button. It attaches the current
playhead position for video, or a pending pin for images, and says which:
"Commenting at 0:28" or "Commenting on the marked point".

- [ ] **Step 4: Write VideoShare**

Layout: a 52px header bar, the media at full content width inside a
`CaptureFrame treatment="passive"`, the timeline with a marker button per
comment (`aria-label="Comment at {mm:ss}"`), then the comment columns positioned
by `columnPositions`. A 72px metadata margin. No sidebar.

Every comment is a button with
`aria-label="Comment {index} from {author}{needsReply ? ', needs a reply' : ''}"`.

- [ ] **Step 5: Rewrite the shell**

`ShareView.tsx` fetches the capture, then chooses:

```tsx
if (capture.visibility === 'private') return <PrivateCapture … />;
if (capture.status === 'processing') return <ProcessingCapture … />;
const mobile = bp === 'mobile';
if (capture.kind === 'recording') return mobile ? <MobileVideoShare … /> : <VideoShare … />;
return mobile ? <MobileImageShare … /> : <ImageShare … />;
```

- [ ] **Step 6: Run the tests**

Run: `npm run test --workspace=apps/web && npm run build --workspace=apps/web`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages
git commit -m "feat(web): rebuild the video share page with timecode anchoring"
```

---

## Task 4: The image share body (C2)

**Files:**
- Create: `apps/web/src/pages/Share/ImageShare.tsx`
- Create: `apps/web/src/pages/Share/__tests__/ImageShare.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Share/__tests__/ImageShare.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageShare } from '../ImageShare';

const capture = { id: 'c2', title: 'Plan selection', owner: 'Priya Raman',
  imageUrl: 'blob:x', width: 2880, height: 1620, allowDownload: true };

const comments = [
  { id: '1', author: 'Dan', body: 'Move this up', createdAt: '', index: 1,
    anchor: { kind: 'point' as const, x: 0.3, y: 0.4 }, needsReply: false, resolved: false },
  { id: '2', author: 'Maya', body: 'Colour is off', createdAt: '', index: 2,
    anchor: { kind: 'point' as const, x: 0.7, y: 0.6 }, needsReply: false, resolved: false },
  { id: '3', author: 'Sam', body: 'Which build?', createdAt: '', index: 3,
    anchor: { kind: 'point' as const, x: 0.5, y: 0.2 }, needsReply: true, resolved: false },
  { id: '4', author: 'Ana', body: 'Fixed', createdAt: '', index: 4,
    anchor: { kind: 'point' as const, x: 0.1, y: 0.1 }, needsReply: false, resolved: true },
];

describe('image share (C2)', () => {
  it('numbers every pin so they are distinguishable without colour', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={() => {}} />);
    for (const n of ['1', '2', '3']) {
      expect(screen.getByRole('button', { name: `Pin ${n}` })).toHaveTextContent(n);
    }
  });

  it('inverts the pin and fills the note when a pin is selected', async () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin 2' }));
    expect(screen.getByRole('button', { name: 'Pin 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('note-2').dataset.selected).toBe('true');
  });

  it('draws leaders when the margin is wide enough', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={() => {}} />);
    expect(screen.getAllByTestId('leader').length).toBeGreaterThan(0);
  });

  it('drops leaders entirely below 300px of margin', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={280} onPost={() => {}} />);
    expect(screen.queryAllByTestId('leader')).toHaveLength(0);
  });

  it('collapses resolved comments under a count', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={() => {}} />);
    expect(screen.getByRole('button', { name: '1 resolved' })).toBeInTheDocument();
    expect(screen.queryByText('Fixed')).toBeNull();
  });

  it('drops a resolved pin to a faint outline rather than removing it', () => {
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pin 4' })).toHaveAttribute('data-resolved', 'true');
  });

  it('places a new pin where the image was clicked, normalised', async () => {
    const onPost = vi.fn();
    render(<ImageShare capture={capture} comments={comments} marginPx={360} onPost={onPost} />);
    const canvas = screen.getByTestId('image-canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 800, height: 450, right: 800, bottom: 450 }),
    });
    await userEvent.pointer({ target: canvas, coords: { clientX: 200, clientY: 225 } });
    await userEvent.click(canvas);
    await userEvent.type(screen.getByRole('textbox', { name: /comment/i }), 'Here');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ anchorX: 0.25, anchorY: 0.5 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- ImageShare`
Expected: FAIL — cannot resolve `../ImageShare`.

- [ ] **Step 3: Write ImageShare**

Pin states, exactly as specified:

| state | treatment |
|---|---|
| unselected | outline |
| selected | cyan fill, pin inverts |
| awaiting a reply | coral outline |
| resolved | 40% grey outline, note collapsed under "{n} resolved" |

Pins are 22px and **never scale with the image** — they stay legible when the
screenshot is zoomed. Leaders are `<svg>` hairlines rendered only when
`leadersVisible(marginPx)`.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build --workspace=apps/web
git add apps/web/src/pages/Share
git commit -m "feat(web): add coordinate-anchored image comments"
```

---

## Task 5: Mobile share (C3, C4)

**Files:**
- Create: `apps/web/src/pages/Share/MobileVideoShare.tsx`
- Create: `apps/web/src/pages/Share/MobileImageShare.tsx`
- Create: `apps/web/src/pages/Share/__tests__/mobileShare.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Share/__tests__/mobileShare.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileVideoShare } from '../MobileVideoShare';
import { MobileImageShare } from '../MobileImageShare';

const video = { id: 'c1', title: 'Bug repro', owner: 'Priya', durationMs: 47_000,
  streamUrl: 'blob:x', allowDownload: true };
const image = { id: 'c2', title: 'Plan selection', owner: 'Priya', imageUrl: 'blob:x',
  width: 2880, height: 1620, allowDownload: true };

const vComments = [
  { id: '1', author: 'Sam', body: 'Which build?', createdAt: '', index: 1,
    anchor: { kind: 'timecode' as const, ms: 39_000 }, needsReply: true, resolved: false },
];
const iComments = [
  { id: '1', author: 'Sam', body: 'Move this', createdAt: '', index: 1,
    anchor: { kind: 'point' as const, x: 0.3, y: 0.4 }, needsReply: false, resolved: false },
];

describe('mobile video share (C3)', () => {
  it('pins the player so seeking never scrolls it out of view', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.getByTestId('sticky-player').dataset.sticky).toBe('true');
  });

  it('keeps the timecode column but drops the time-axis layout', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.getByText('0:39')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-columns')).toBeNull();
  });

  it('names what needs attention on the sheet', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.getByText(/1 needs a reply/)).toBeInTheDocument();
  });

  it('pads every control to 44px, including the player icons', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={() => {}} onPost={() => {}} />);
    for (const b of screen.getAllByRole('button')) {
      expect(Number(b.dataset.minTarget)).toBeGreaterThanOrEqual(44);
    }
  });

  it('moves download and delete into an overflow sheet, away from playback', async () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={() => {}} onPost={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});

describe('mobile image share (C4)', () => {
  it('draws no leaders at all', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={() => {}} />);
    expect(screen.queryAllByTestId('leader')).toHaveLength(0);
  });

  it('pairs comment and pin by selection instead, and by number', async () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={() => {}} />);
    await userEvent.click(screen.getByTestId('note-1'));
    expect(screen.getByRole('button', { name: 'Pin 1' })).toHaveAttribute('data-halo', 'true');
    expect(screen.getByTestId('note-1').dataset.selected).toBe('true');
  });

  it('keeps pins at 22px with a 44px tap area', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={() => {}} />);
    const pin = screen.getByRole('button', { name: 'Pin 1' });
    expect(pin.dataset.pinSize).toBe('22');
    expect(Number(pin.dataset.minTarget)).toBe(44);
  });

  it('places a provisional pin on long-press, draggable before commit', async () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={() => {}} />);
    const canvas = screen.getByTestId('image-canvas');
    await userEvent.pointer([
      { keys: '[TouchA>]', target: canvas, coords: { clientX: 100, clientY: 100 } },
    ]);
    await new Promise(r => setTimeout(r, 550));
    expect(screen.getByTestId('provisional-pin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- mobileShare`
Expected: FAIL.

- [ ] **Step 3: Implement both**

`MobileVideoShare` — `position: sticky` player under the header with
`data-sticky="true"`, comments in a scrolling sheet below with a drag handle, a
count, and a coral line naming what needs attention. Every control
`data-min-target="44"`. Download and delete behind a "More" overflow sheet.

`MobileImageShare` — no leaders. Selecting a note gives its pin a cyan halo
(`data-halo="true"`) and fills the note. Pins carry `data-pin-size="22"` and
`data-min-target="44"`. Long-press (500ms) places `[data-testid="provisional-pin"]`
that can be dragged before committing — a tap alone is ambiguous with panning a
zoomed image.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build --workspace=apps/web
git add apps/web/src/pages/Share
git commit -m "feat(web): add the mobile share layouts"
```

---

## Task 6: Private and processing (C5, C6)

**Files:**
- Create: `apps/web/src/pages/Share/PrivateCapture.tsx`
- Create: `apps/web/src/pages/Share/ProcessingCapture.tsx`
- Create: `apps/web/src/pages/Share/__tests__/noMedia.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Share/__tests__/noMedia.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivateCapture } from '../PrivateCapture';
import { ProcessingCapture } from '../ProcessingCapture';

describe('private capture (C5)', () => {
  it('names the owner and offers one action', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={() => {}} />);
    expect(screen.getByText(/Priya Raman/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request access/ })).toBeInTheDocument();
  });

  it('is not an error — no coral anywhere', () => {
    const { container } = render(<PrivateCapture owner="Priya Raman" onRequestAccess={() => {}} />);
    expect(container.innerHTML).not.toContain('coral');
  });

  it('draws no frame and no registration marks — there is no media', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={() => {}} />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('is the only share surface that carries promotion', () => {
    render(<PrivateCapture owner="Priya Raman" onRequestAccess={() => {}} />);
    expect(screen.getByText('What is SnapRec?')).toBeInTheDocument();
  });
});

describe('processing capture (C6)', () => {
  const capture = { title: 'Sprint demo', owner: 'Priya Raman',
    duration: '6:38', dimensions: '1920×1080' };

  it('shows what is already known so the page is useful immediately', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.getByText('Sprint demo')).toBeInTheDocument();
    expect(screen.getByText(/6:38/)).toBeInTheDocument();
    expect(screen.getByText(/1920×1080/)).toBeInTheDocument();
  });

  it('uses the indeterminate sweep, not a percentage', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.getByTestId('sweep')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('keeps the frame passive — nothing to focus on yet', () => {
    render(<ProcessingCapture capture={capture} />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
    expect(screen.queryAllByTestId('handle')).toHaveLength(0);
  });

  it('announces processing once, politely, and does not poll-announce', () => {
    render(<ProcessingCapture capture={capture} />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('processing');
    expect(live.dataset.announceOnce).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- noMedia`
Expected: FAIL.

- [ ] **Step 3: Implement both**

`PrivateCapture` — no media, so no frame, no registration marks, no metadata
margin. Optical language survives only as alignment and one neutral outlined
mark. Copy names the owner and offers Request access. Carries the single
"What is SnapRec?" block — the only promotion on any share surface, and only
because there is nothing to look at.

`ProcessingCapture` — a plain boundary with the same indeterminate cyan sweep
used by the extension's finishing state, so viewers and owners read one signal
for "work in progress, duration unknown". Title, owner, duration and dimensions
render immediately and the layout does not reflow when the media arrives —
reserve the media box at the known aspect ratio.

- [ ] **Step 4: Run the tests and commit**

```bash
npm run test --workspace=apps/web && npm run build --workspace=apps/web
git add apps/web/src/pages/Share
git commit -m "feat(web): add the private and processing share states"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Run every suite**

```bash
npm test --workspace=packages/design-system
npm run test --workspace=apps/web
npm test --workspace=apps/server
npm run build:prerender --workspace=apps/web
```

- [ ] **Step 2: Verify logged out**

Start the dev server and the API. In a private window with no session:

1. Open a shared video link. Post a comment as a guest. Confirm it appears with
   a timecode marker and that clicking the marker seeks.
2. Open a shared screenshot link. Click the image, place a pin, post. Reload —
   the pin is in the same place.
3. Resize from 1440 to 900: confirm leaders disappear at the 300px margin
   threshold, not at an arbitrary breakpoint.
4. Resize to 390: confirm the player sticks and download moves into More.
5. Open a private capture link: confirm Request access, no coral, and the single
   promotional block.
6. Open a capture mid-processing: confirm the sweep, the known metadata, and
   that the page does not reflow when the video becomes available.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: verify the share surfaces end to end"
```

---

## Exit criteria

- All four suites pass.
- A share link opened logged out renders C1 or C2 correctly and accepts a guest
  comment.
- Timecode and point anchoring both round-trip through the API.
- Leaders appear and disappear at exactly 300px of margin.
- C5 and C6 render with no media, no coral, and no registration marks.
