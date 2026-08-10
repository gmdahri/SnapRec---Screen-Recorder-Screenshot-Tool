# P1 Component Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the eight components the standalone prototypes specify by name, plus the 13-state capture model they all read from, so P2–P6 have a shared vocabulary instead of re-inventing plates and status rules per surface.

**Architecture:** The prototypes' `spec` scene names nine own-components; `PathSpine` already exists, leaving eight to build. All eight live in `packages/design-system/src/primitives/` beside the P0 ten and read the same `--sr-*` custom properties. The status model moves from a flat 9-string list to a keyed record of 13 capture states, each carrying its label, rule treatment, primary action and capability flags — because every surface in P2–P5 renders the same state differently and they must not drift.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 3 + Testing Library (already configured in this workspace), `@iconify/react`.

## Global Constraints

Inherited verbatim from `2026-08-08-plate-redesign-roadmap.md` § "Global constraints". Every task's requirements implicitly include that section. The five conflicts in § "Known conflicts" are resolved in Task 1 and must not be re-opened later.

Additional, P1-specific:

- **No component in this phase renders a hex literal.** The contrast suite and a new lint test both enforce it.
- **No component in this phase imports from `apps/`.** The package is consumed, never consuming.
- **Every component takes `surface?: 'light' | 'dark'`** where it can appear on both, defaulting to `'light'`. `AppRail` and `SelectionBar` are carbon-only and take no such prop.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/status.ts` | **Extended.** The 17-word vocabulary plus the 13-state `CAPTURE_STATES` record |
| `src/primitives/StateRule.tsx` | The 2px left / 3px bottom rule — sole visual carrier of status |
| `src/primitives/StatusBadge.tsx` | 19px outlined badge, word + shape (replaces `StatusChip`) |
| `src/primitives/CaptureFrame.tsx` | Registration-mark corners; also the empty-state illustration |
| `src/primitives/CapturePlate.tsx` | Media box + caption + hover action rail + state rule |
| `src/primitives/CaptureRow.tsx` | The 9-column list row with mono metadata rail |
| `src/primitives/ActivityRow.tsx` | 44×26 capture frame + actor/event + inline action |
| `src/primitives/SelectionBar.tsx` | Carbon bulk toolbar, destructive action separated |
| `src/primitives/AppRail.tsx` | 68px carbon nav, cyan active mark, extension indicator |
| `src/primitives/PathSpine.tsx` | **Extended** with `failed` / `offline` tick rendering |
| `src/index.ts` | **Extended** barrel |
| `apps/web/vitest.config.ts` | New — jsdom test environment for P3–P6 |

`StatusChip.tsx` is deleted in Task 2. Nothing consumes it yet outside its own test.

---

## Task 1: Extend the status model to the 13 capture states

**Files:**
- Modify: `packages/design-system/src/status.ts`
- Modify: `packages/design-system/src/tokens.css` (two height additions)
- Test: `packages/design-system/src/__tests__/status.test.tsx`
- Test: `packages/design-system/src/__tests__/controls.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type StatusWord` — 17-member union
  - `type CaptureStatus` — 13-member union, the keys of `CAPTURE_STATES`
  - `const CAPTURE_STATES: Record<CaptureStatus, CaptureStateDef>`
  - `interface CaptureStateDef { label: string; rule: RuleTreatment; ruleWidth: string; primary: string; secondary: string[]; canPreview: boolean; canShare: boolean; canSelect: boolean; survivesLeaving: boolean; }`
  - `type RuleTreatment = 'none' | 'cyan-partial' | 'cyan-full' | 'coral-full' | 'grey-dashed'`
  - `--sr-h-2xs: 32px`, `--sr-h-row: 36px`

- [ ] **Step 1: Write the failing test**

Add to `packages/design-system/src/__tests__/status.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { CAPTURE_STATES, STATUS_WORDS, type CaptureStatus } from '../status';

describe('capture state model', () => {
  it('holds exactly the thirteen states the prototype specifies', () => {
    expect(Object.keys(CAPTURE_STATES).sort()).toEqual([
      'draftEdit', 'exportFailed', 'exporting', 'localOnly', 'processing',
      'processingFailed', 'queuedOffline', 'ready', 'savedPrivately',
      'shared', 'unavailable', 'uploadFailed', 'uploading',
    ]);
  });

  it('never renders a failure state as anything but a full coral rule', () => {
    const failures: CaptureStatus[] = ['uploadFailed', 'processingFailed', 'exportFailed'];
    for (const key of failures) {
      expect(CAPTURE_STATES[key].rule).toBe('coral-full');
      expect(CAPTURE_STATES[key].ruleWidth).toBe('100%');
    }
  });

  it('never renders offline as coral — queued work has not failed', () => {
    expect(CAPTURE_STATES.queuedOffline.rule).toBe('grey-dashed');
  });

  it('states with no media cannot be previewed', () => {
    expect(CAPTURE_STATES.processing.canPreview).toBe(false);
    expect(CAPTURE_STATES.processingFailed.canPreview).toBe(false);
    expect(CAPTURE_STATES.unavailable.canPreview).toBe(false);
  });

  it('only uploaded states can be shared', () => {
    expect(CAPTURE_STATES.localOnly.canShare).toBe(false);
    expect(CAPTURE_STATES.uploading.canShare).toBe(false);
    expect(CAPTURE_STATES.queuedOffline.canShare).toBe(false);
    expect(CAPTURE_STATES.shared.canShare).toBe(true);
  });

  it('every state label appears in the fixed vocabulary', () => {
    for (const def of Object.values(CAPTURE_STATES)) {
      const bare = def.label.replace(/\s\d+%$/, '');
      expect(STATUS_WORDS).toContain(bare);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- status`
Expected: FAIL — `CAPTURE_STATES` is not exported from `../status`.

- [ ] **Step 3: Write the implementation**

Replace the contents of `packages/design-system/src/status.ts`:

```ts
/** The fixed vocabulary. These strings are never paraphrased anywhere in the product.
 *
 * P0 shipped nine words from spec §3. The standalone prototypes' capture item
 * model (file 03, scene MODEL) needs eight more. This is the union; nothing may
 * be added without a corresponding entry in CAPTURE_STATES or a chip usage. */
export const STATUS_WORDS = [
  'on this device',
  'uploading',
  'saved to library',
  'link ready',
  'processing',
  'private',
  'shared',
  'needs a reply',
  'recording',
  'queued',
  'ready',
  'upload failed',
  'processing failed',
  'draft edit',
  'exporting',
  'export failed',
  'unavailable',
] as const;

export type StatusWord = (typeof STATUS_WORDS)[number];

/** The path spine, always in this order. Reused as progress bar and library status line. */
export const PATH_NODES = [
  'on this device',
  'uploading',
  'saved to library',
  'link ready',
] as const satisfies readonly StatusWord[];

export type PathState = 'normal' | 'failed' | 'offline' | 'queued';

/** How the state rule is drawn. The rule is the *single* visual carrier of
 * status — badges and words repeat it, they never replace it. */
export type RuleTreatment =
  | 'none'
  | 'cyan-partial'
  | 'cyan-full'
  | 'coral-full'
  | 'grey-dashed';

export interface CaptureStateDef {
  /** The word shown to the user. Percentage-bearing labels carry a `%s` slot. */
  label: string;
  rule: RuleTreatment;
  /** Width of the bottom rule. '0%' means no rule is drawn. */
  ruleWidth: string;
  /** The one action that leads the edge rail. */
  primary: string;
  secondary: string[];
  canPreview: boolean;
  canShare: boolean;
  canSelect: boolean;
  /** Whether the work survives the user closing the surface. */
  survivesLeaving: boolean;
}

export type CaptureStatus =
  | 'localOnly'
  | 'uploading'
  | 'queuedOffline'
  | 'savedPrivately'
  | 'processing'
  | 'ready'
  | 'shared'
  | 'uploadFailed'
  | 'processingFailed'
  | 'draftEdit'
  | 'exporting'
  | 'exportFailed'
  | 'unavailable';

/** Verbatim from file 03, scene MODEL. Every surface in P2–P5 reads this;
 * none of them re-decide what a state looks like or what it permits. */
export const CAPTURE_STATES: Record<CaptureStatus, CaptureStateDef> = {
  localOnly: {
    label: 'on this device', rule: 'none', ruleWidth: '0%',
    primary: 'Upload and get link',
    secondary: ['copy', 'download', 'annotate', 'discard'],
    canPreview: true, canShare: false, canSelect: true, survivesLeaving: true,
  },
  uploading: {
    label: 'uploading', rule: 'cyan-partial', ruleWidth: '58%',
    primary: 'Cancel upload',
    secondary: ['download', 'copy'],
    canPreview: true, canShare: false, canSelect: false, survivesLeaving: true,
  },
  queuedOffline: {
    label: 'queued', rule: 'grey-dashed', ruleWidth: '100%',
    primary: 'Download now',
    secondary: ['retry now', 'keep local'],
    canPreview: true, canShare: false, canSelect: true, survivesLeaving: true,
  },
  savedPrivately: {
    label: 'private', rule: 'none', ruleWidth: '0%',
    primary: 'Create share link',
    secondary: ['open', 'edit', 'move', 'rename', 'download', 'delete'],
    canPreview: true, canShare: true, canSelect: true, survivesLeaving: true,
  },
  processing: {
    label: 'processing', rule: 'cyan-full', ruleWidth: '100%',
    primary: 'Copy link',
    secondary: ['rename', 'delete'],
    canPreview: false, canShare: true, canSelect: false, survivesLeaving: true,
  },
  ready: {
    label: 'ready', rule: 'none', ruleWidth: '0%',
    primary: 'Open',
    secondary: ['edit', 'share', 'download', 'move', 'rename', 'delete'],
    canPreview: true, canShare: true, canSelect: true, survivesLeaving: true,
  },
  shared: {
    label: 'shared', rule: 'none', ruleWidth: '0%',
    primary: 'Copy link',
    secondary: ['permissions', 'activity', 'turn sharing off', 'edit'],
    canPreview: true, canShare: true, canSelect: true, survivesLeaving: true,
  },
  uploadFailed: {
    label: 'upload failed', rule: 'coral-full', ruleWidth: '100%',
    primary: 'Try upload again',
    secondary: ['download', 'keep local', 'remove'],
    canPreview: true, canShare: false, canSelect: true, survivesLeaving: true,
  },
  processingFailed: {
    label: 'processing failed', rule: 'coral-full', ruleWidth: '100%',
    primary: 'Try again',
    secondary: ['download source', 'delete'],
    canPreview: false, canShare: false, canSelect: true, survivesLeaving: true,
  },
  draftEdit: {
    label: 'draft edit', rule: 'none', ruleWidth: '0%',
    primary: 'Continue editing',
    secondary: ['discard draft', 'duplicate', 'delete'],
    canPreview: true, canShare: false, canSelect: true, survivesLeaving: true,
  },
  exporting: {
    label: 'exporting', rule: 'cyan-partial', ruleWidth: '58%',
    primary: 'Stop export',
    secondary: ['open editor'],
    canPreview: true, canShare: false, canSelect: false, survivesLeaving: true,
  },
  exportFailed: {
    label: 'export failed', rule: 'coral-full', ruleWidth: '100%',
    primary: 'Try export again',
    secondary: ['open editor', 'download source'],
    canPreview: true, canShare: false, canSelect: true, survivesLeaving: true,
  },
  unavailable: {
    label: 'unavailable', rule: 'grey-dashed', ruleWidth: '0%',
    primary: 'Remove from my list',
    secondary: [],
    canPreview: false, canShare: false, canSelect: false, survivesLeaving: true,
  },
};
```

- [ ] **Step 4: Add the two control heights**

In `packages/design-system/src/tokens.css`, replace the control-heights block:

```css
  /* Control heights.
   * P0 shipped four. The standalone prototypes need two more: 32px for the web
   * app's top-bar controls and inline row actions, 36px for the extension's
   * option rows (fixed so the panel holds at 125% browser zoom). These six are
   * the complete set. */
  --sr-h-2xs: 32px;
  --sr-h-xs: 30px;
  --sr-h-sm: 34px;
  --sr-h-md: 40px;
  --sr-h-lg: 46px;
  --sr-h-row: 36px;
```

- [ ] **Step 5: Update the control-height test**

In `packages/design-system/src/__tests__/controls.test.tsx`, find the assertion listing the permitted heights and replace it:

```tsx
it('exposes exactly six control heights', () => {
  const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');
  const heights = [...css.matchAll(/--sr-h-[a-z0-9]+:\s*(\d+)px/g)].map(m => m[1]);
  expect(heights.sort()).toEqual(['30', '32', '34', '36', '40', '46']);
});
```

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace=packages/design-system`
Expected: PASS, all suites.

- [ ] **Step 7: Commit**

```bash
git add packages/design-system/src/status.ts packages/design-system/src/tokens.css packages/design-system/src/__tests__/
git commit -m "feat(ds): extend status model to the 13 capture states"
```

---

## Task 2: StateRule and StatusBadge

**Files:**
- Create: `packages/design-system/src/primitives/StateRule.tsx`
- Create: `packages/design-system/src/primitives/StatusBadge.tsx`
- Delete: `packages/design-system/src/primitives/StatusChip.tsx`
- Create: `packages/design-system/src/__tests__/StateRule.test.tsx`
- Modify: `packages/design-system/src/__tests__/status.test.tsx` (retarget chip assertions)
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: `CAPTURE_STATES`, `CaptureStatus`, `RuleTreatment`, `StatusWord` from Task 1.
- Produces:
  - `<StateRule status={CaptureStatus} progress?={number} edge?={'left' | 'bottom' | 'both'} />`
  - `<StatusBadge status={StatusWord} surface?={'light' | 'dark'} />` — 19px

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/StateRule.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StateRule } from '../primitives/StateRule';
import { StatusBadge } from '../primitives/StatusBadge';

describe('StateRule', () => {
  it('draws nothing for states with no rule', () => {
    render(<StateRule status="ready" />);
    expect(screen.queryByTestId('state-rule-bottom')).toBeNull();
  });

  it('draws a full coral rule for a failed upload', () => {
    render(<StateRule status="uploadFailed" />);
    const rule = screen.getByTestId('state-rule-bottom');
    expect(rule).toHaveStyle({ width: '100%' });
    expect(rule.style.background).toBe('var(--sr-coral-text)');
  });

  it('lets progress override the default partial width', () => {
    render(<StateRule status="uploading" progress={42} />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveStyle({ width: '42%' });
  });

  it('draws offline as a dashed grey rule, never coral', () => {
    render(<StateRule status="queuedOffline" />);
    const rule = screen.getByTestId('state-rule-bottom');
    expect(rule.style.background).not.toContain('coral');
    expect(rule.style.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('is hidden from assistive tech — the badge carries the word', () => {
    render(<StateRule status="uploadFailed" />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('StatusBadge', () => {
  it('is 19px tall', () => {
    render(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge')).toHaveStyle({ height: '19px' });
  });

  it('always renders the word, never colour alone', () => {
    render(<StatusBadge status="upload failed" />);
    expect(screen.getByText('upload failed')).toBeInTheDocument();
  });

  it('reserves coral for the two permitted statuses', () => {
    const { rerender } = render(<StatusBadge status="needs a reply" />);
    expect(screen.getByTestId('badge').style.color).toBe('var(--sr-coral-hover)');
    rerender(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge').style.color).not.toContain('coral');
  });

  it('is outlined, never a filled pill', () => {
    render(<StatusBadge status="shared" />);
    expect(screen.getByTestId('badge').style.background).toBe('transparent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- StateRule`
Expected: FAIL — cannot resolve `../primitives/StateRule`.

- [ ] **Step 3: Write StateRule**

Create `packages/design-system/src/primitives/StateRule.tsx`:

```tsx
import { CAPTURE_STATES, type CaptureStatus, type RuleTreatment } from '../status';

/** The 2px left rule and 3px bottom rule. This is the single visual carrier of
 * the status model — every surface that shows a capture draws it identically.
 * It is decorative: StatusBadge carries the word for assistive tech. */
export interface StateRuleProps {
  status: CaptureStatus;
  /** 0–100. Overrides the state's default width for determinate work. */
  progress?: number;
  edge?: 'left' | 'bottom' | 'both';
}

const COLOR: Record<RuleTreatment, string> = {
  none: 'transparent',
  'cyan-partial': 'var(--sr-cyan)',
  'cyan-full': 'var(--sr-cyan)',
  'coral-full': 'var(--sr-coral-text)',
  'grey-dashed': 'transparent',
};

export function StateRule({ status, progress, edge = 'bottom' }: StateRuleProps) {
  const def = CAPTURE_STATES[status];
  if (def.rule === 'none' || def.ruleWidth === '0%') return null;

  const width = progress != null ? `${progress}%` : def.ruleWidth;
  const dashed = def.rule === 'grey-dashed';

  const bottom = (
    <span
      data-testid="state-rule-bottom"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 3,
        width,
        background: COLOR[def.rule],
        backgroundImage: dashed
          ? 'repeating-linear-gradient(90deg, var(--sr-text-faint-on-light) 0 6px, transparent 6px 12px)'
          : undefined,
        transition: 'width var(--sr-dur-slow) var(--sr-ease)',
      }}
    />
  );

  const left = (
    <span
      data-testid="state-rule-left"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 2,
        background: dashed ? 'var(--sr-text-faint-on-light)' : COLOR[def.rule],
      }}
    />
  );

  return (
    <>
      {(edge === 'left' || edge === 'both') && left}
      {(edge === 'bottom' || edge === 'both') && bottom}
    </>
  );
}
```

- [ ] **Step 4: Write StatusBadge**

Create `packages/design-system/src/primitives/StatusBadge.tsx`:

```tsx
import type { StatusWord } from '../status';
import type { Surface } from './Button';

/** Only these two statuses may wear coral. */
const CORAL: ReadonlySet<StatusWord> = new Set<StatusWord>(['recording', 'needs a reply']);
/** These read as cyan — the sharing family. */
const CYAN: ReadonlySet<StatusWord> = new Set<StatusWord>([
  'shared', 'link ready', 'uploading', 'processing', 'exporting',
]);

export interface StatusBadgeProps {
  status: StatusWord;
  surface?: Surface;
}

/** 19px outlined badge: word plus shape, never a filled pill. Replaces P0's
 * 22px StatusChip — the prototypes are specific about the height. */
export function StatusBadge({ status, surface = 'light' }: StatusBadgeProps) {
  const coral = CORAL.has(status);
  const cyan = CYAN.has(status);
  const failed = status.endsWith('failed');

  const color = coral || failed
    ? 'var(--sr-coral-hover)'
    : cyan
      ? surface === 'dark' ? 'var(--sr-cyan)' : 'var(--sr-cyan-on-light)'
      : surface === 'dark' ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-faint-on-light)';

  return (
    <span
      data-testid="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 19,
        padding: '0 7px',
        background: 'transparent',
        border: `1px solid ${cyan ? 'var(--sr-cyan)' : surface === 'dark' ? 'var(--sr-border-dark)' : 'var(--sr-border-light)'}`,
        fontFamily: 'var(--sr-font-mono)',
        fontSize: 9.5,
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {(cyan || coral) && (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            background: coral ? 'var(--sr-coral-mark)' : 'var(--sr-cyan)',
            borderRadius: status === 'recording' ? '50%' : 0,
          }}
        />
      )}
      {status}
    </span>
  );
}
```

- [ ] **Step 5: Delete StatusChip and retarget its tests**

```bash
rm packages/design-system/src/primitives/StatusChip.tsx
```

In `packages/design-system/src/__tests__/status.test.tsx`, replace every
`import { StatusChip } from '../primitives/StatusChip'` with
`import { StatusBadge } from '../primitives/StatusBadge'`, every `<StatusChip`
with `<StatusBadge`, and change any assertion of `height: '22px'` to `'19px'`.

- [ ] **Step 6: Update the barrel**

In `packages/design-system/src/index.ts`, replace the `StatusChip` line:

```ts
export { StatusBadge, type StatusBadgeProps } from './primitives/StatusBadge';
export { StateRule, type StateRuleProps } from './primitives/StateRule';
export {
  STATUS_WORDS, PATH_NODES, CAPTURE_STATES,
  type StatusWord, type PathState, type CaptureStatus,
  type CaptureStateDef, type RuleTreatment,
} from './status';
```

Remove the old `export { StatusChip … }` and old `export { STATUS_WORDS … }` lines.

- [ ] **Step 7: Run the tests**

Run: `npm test --workspace=packages/design-system`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add StateRule, replace StatusChip with 19px StatusBadge"
```

---

## Task 3: CaptureFrame — registration marks

**Files:**
- Create: `packages/design-system/src/primitives/CaptureFrame.tsx`
- Create: `packages/design-system/src/__tests__/CaptureFrame.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<CaptureFrame treatment={'focused' | 'passive' | 'editable'} inset?={number} size?={number} tone?={'cyan' | 'coral' | 'neutral'}>{children}</CaptureFrame>`

The existing `Frame` primitive from P0 handles surface treatments. `CaptureFrame` is different: it draws only the four corner marks, is used standalone as the L5 empty-state illustration, and is the thing that animates in the corner strike.

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/CaptureFrame.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaptureFrame } from '../primitives/CaptureFrame';

describe('CaptureFrame', () => {
  it('draws four corner marks when focused', () => {
    render(<CaptureFrame treatment="focused" />);
    expect(screen.getAllByTestId('registration-mark')).toHaveLength(4);
  });

  it('draws no marks when passive — nothing to focus on yet', () => {
    render(<CaptureFrame treatment="passive" />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('draws solid handles only when editable', () => {
    render(<CaptureFrame treatment="editable" />);
    expect(screen.getAllByTestId('handle')).toHaveLength(8);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });

  it('uses coral marks for live capture', () => {
    render(<CaptureFrame treatment="focused" tone="coral" />);
    const mark = screen.getAllByTestId('registration-mark')[0];
    expect(mark.style.borderTopColor).toBe('var(--sr-coral-mark)');
  });

  it('renders its children inside the frame', () => {
    render(<CaptureFrame treatment="focused"><span>preview</span></CaptureFrame>);
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('marks the frame decorative — the surface names its own state', () => {
    render(<CaptureFrame treatment="focused" />);
    for (const m of screen.getAllByTestId('registration-mark')) {
      expect(m).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- CaptureFrame`
Expected: FAIL — cannot resolve `../primitives/CaptureFrame`.

- [ ] **Step 3: Write the implementation**

Create `packages/design-system/src/primitives/CaptureFrame.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

/** Registration-mark corners. The three treatments are a contract:
 *
 *  focused  — cyan marks inset from the corners, no handles. The media is the
 *             subject but cannot be resized, so it must not look draggable.
 *  passive  — a boundary only. Used while processing: there is nothing to
 *             focus on yet.
 *  editable — solid handles. This is permitted on exactly one surface in the
 *             product: the video editor's trim points. */
export type FrameTreatmentKind = 'focused' | 'passive' | 'editable';

export interface CaptureFrameProps {
  treatment: FrameTreatmentKind;
  /** Distance of the marks from the frame edge. */
  inset?: number;
  /** Arm length of each mark. */
  size?: number;
  tone?: 'cyan' | 'coral' | 'neutral';
  children?: ReactNode;
  style?: CSSProperties;
}

const TONE = {
  cyan: 'var(--sr-cyan)',
  coral: 'var(--sr-coral-mark)',
  neutral: 'var(--sr-border-light)',
} as const;

const CORNERS = [
  { left: 0, top: 0, borderLeft: true, borderTop: true },
  { right: 0, top: 0, borderRight: true, borderTop: true },
  { left: 0, bottom: 0, borderLeft: true, borderBottom: true },
  { right: 0, bottom: 0, borderRight: true, borderBottom: true },
] as const;

const HANDLES = [
  { left: '0%', top: '0%' }, { left: '50%', top: '0%' }, { left: '100%', top: '0%' },
  { left: '0%', top: '50%' }, { left: '100%', top: '50%' },
  { left: '0%', top: '100%' }, { left: '50%', top: '100%' }, { left: '100%', top: '100%' },
] as const;

export function CaptureFrame({
  treatment, inset = 6, size = 11, tone = 'cyan', children, style,
}: CaptureFrameProps) {
  const color = TONE[tone];

  return (
    <div style={{ position: 'relative', ...style }}>
      {children}

      {treatment === 'focused' && CORNERS.map((c, i) => (
        <span
          key={i}
          data-testid="registration-mark"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            ...('left' in c ? { left: inset } : { right: inset }),
            ...('top' in c ? { top: inset } : { bottom: inset }),
            borderLeft: c.borderLeft ? `1px solid ${color}` : undefined,
            borderRight: c.borderRight ? `1px solid ${color}` : undefined,
            borderTop: c.borderTop ? `1px solid ${color}` : undefined,
            borderBottom: c.borderBottom ? `1px solid ${color}` : undefined,
            borderTopColor: c.borderTop ? color : undefined,
          }}
        />
      ))}

      {treatment === 'editable' && HANDLES.map((h, i) => (
        <span
          key={i}
          data-testid="handle"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: h.left,
            top: h.top,
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            background: 'var(--sr-cyan)',
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Export it**

Add to `packages/design-system/src/index.ts`:

```ts
export { CaptureFrame, type CaptureFrameProps, type FrameTreatmentKind } from './primitives/CaptureFrame';
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace=packages/design-system -- CaptureFrame`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add CaptureFrame with the three registration treatments"
```

---

## Task 4: CapturePlate

**Files:**
- Create: `packages/design-system/src/primitives/CapturePlate.tsx`
- Create: `packages/design-system/src/__tests__/CapturePlate.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: `CAPTURE_STATES`, `CaptureStatus` (Task 1); `StateRule`, `StatusBadge` (Task 2); `CaptureFrame` (Task 3).
- Produces:
  ```ts
  interface CaptureAction { key: string; label: string; icon: string; onSelect: () => void; disabledReason?: string }
  interface CapturePlateProps {
    title: string;
    meta: string;
    status: CaptureStatus;
    progress?: number;
    kind: 'recording' | 'screenshot' | 'fullpage';
    duration?: string;
    dimensions?: string;
    actions: CaptureAction[];
    footnotes?: ReactNode;
    selected?: boolean;
    onOpen?: () => void;
    onSelectToggle?: () => void;
    media?: ReactNode;
  }
  ```

This replaces `Card` entirely — nothing in P2–P6 may introduce a card.

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/CapturePlate.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapturePlate } from '../primitives/CapturePlate';

const base = {
  title: 'Checkout button misaligned on mobile Safari',
  meta: 'recording · 2h ago · 7.2 MB',
  kind: 'recording' as const,
  duration: '0:47',
  actions: [],
};

describe('CapturePlate', () => {
  it('names its status in words, not colour alone', () => {
    render(<CapturePlate {...base} status="shared" />);
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  it('draws the state rule for in-progress work', () => {
    render(<CapturePlate {...base} status="uploading" progress={62} />);
    expect(screen.getByTestId('state-rule-bottom')).toHaveStyle({ width: '62%' });
  });

  it('shows no media affordance for states that cannot be previewed', () => {
    render(<CapturePlate {...base} status="processing" media={<img alt="preview" />} />);
    expect(screen.queryByAltText('preview')).toBeNull();
  });

  it('renders only the actions it was given', async () => {
    const copy = vi.fn();
    render(
      <CapturePlate {...base} status="shared" actions={[
        { key: 'copy', label: 'Copy link', icon: 'ant-design:link-outlined', onSelect: copy },
      ]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(copy).toHaveBeenCalledOnce();
  });

  it('gives a disabled action a reason, never a dead end', () => {
    render(
      <CapturePlate {...base} status="uploading" actions={[
        { key: 'copy', label: 'Copy link', icon: 'ant-design:link-outlined',
          onSelect: () => {}, disabledReason: 'Available once the upload finishes' },
      ]} />,
    );
    const btn = screen.getByRole('button', { name: /Copy link/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('title', 'Available once the upload finishes');
  });

  it('is not selectable in states that forbid it', () => {
    const toggle = vi.fn();
    render(<CapturePlate {...base} status="uploading" onSelectToggle={toggle} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('exposes a checkbox when selection is permitted', () => {
    render(<CapturePlate {...base} status="ready" onSelectToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('uses a passive frame while processing — nothing to focus on yet', () => {
    render(<CapturePlate {...base} status="processing" />);
    expect(screen.queryAllByTestId('registration-mark')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- CapturePlate`
Expected: FAIL — cannot resolve `../primitives/CapturePlate`.

- [ ] **Step 3: Write the implementation**

Create `packages/design-system/src/primitives/CapturePlate.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { CAPTURE_STATES, type CaptureStatus } from '../status';
import { StateRule } from './StateRule';
import { StatusBadge } from './StatusBadge';
import { CaptureFrame } from './CaptureFrame';

export interface CaptureAction {
  key: string;
  label: string;
  icon: string;
  onSelect: () => void;
  /** When present the action renders disabled and this becomes its tooltip.
   * Disabled actions must always say when they become available. */
  disabledReason?: string;
}

export interface CapturePlateProps {
  title: string;
  meta: string;
  status: CaptureStatus;
  /** 0–100, for determinate work only. */
  progress?: number;
  kind: 'recording' | 'screenshot' | 'fullpage';
  duration?: string;
  dimensions?: string;
  actions?: CaptureAction[];
  footnotes?: ReactNode;
  selected?: boolean;
  onOpen?: () => void;
  onSelectToggle?: () => void;
  media?: ReactNode;
}

const KIND_ICON = {
  recording: 'ant-design:video-camera-outlined',
  screenshot: 'ant-design:camera-outlined',
  fullpage: 'ant-design:vertical-align-bottom-outlined',
} as const;

/** Media box + caption + hover action rail + state rule. This replaces Card
 * entirely — no surface in the product may introduce one. */
export function CapturePlate({
  title, meta, status, progress, kind, duration, dimensions,
  actions = [], footnotes, selected = false, onOpen, onSelectToggle, media,
}: CapturePlateProps) {
  const def = CAPTURE_STATES[status];
  const stamp = duration ?? dimensions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <CaptureFrame
        treatment={def.canPreview ? 'focused' : 'passive'}
        style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9' }}
      >
        {def.canPreview && media}

        {onSelectToggle && def.canSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectToggle}
            aria-label={`Select ${title}`}
            style={{ position: 'absolute', left: 8, top: 8, width: 16, height: 16, accentColor: 'var(--sr-cyan)' }}
          />
        )}

        {stamp && (
          <span style={{
            position: 'absolute', left: 8, bottom: 8,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 6px', background: 'rgba(4,7,8,.8)',
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-primary-on-dark)',
          }}>
            <Icon icon={KIND_ICON[kind]} width={10} aria-hidden="true" />
            {stamp}
          </span>
        )}

        {actions.length > 0 && (
          <div
            data-testid="action-rail"
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 34,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}
          >
            {actions.map(a => (
              <button
                key={a.key}
                type="button"
                onClick={a.disabledReason ? undefined : a.onSelect}
                aria-disabled={a.disabledReason ? 'true' : undefined}
                title={a.disabledReason ?? a.label}
                aria-label={a.label}
                style={{
                  border: 'none', background: 'transparent', padding: 0,
                  color: a.disabledReason ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-secondary-on-dark)',
                  cursor: a.disabledReason ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                }}
              >
                <Icon icon={a.icon} width={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <StateRule status={status} progress={progress} />
      </CaptureFrame>

      <button
        type="button"
        onClick={onOpen}
        style={{
          padding: '9px 2px 0', border: 'none', background: 'transparent',
          textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5,
          cursor: onOpen ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: 'var(--sr-text-primary-on-light)' }}>
          {title}
        </span>
        <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 10, color: 'var(--sr-text-faint-on-light)' }}>
          {meta}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={def.label as never} />
          {footnotes}
        </span>
      </button>
    </div>
  );
}
```

> **Note on the `as never` cast:** `CaptureStateDef.label` is typed `string` so
> percentage-bearing labels stay expressible. Every label is verified to be a
> `StatusWord` by the Task 1 test, so the cast is sound. Do not widen
> `StatusBadge`'s prop to `string` to avoid it — that would let any surface
> invent a status.

- [ ] **Step 4: Export it**

Add to `packages/design-system/src/index.ts`:

```ts
export { CapturePlate, type CapturePlateProps, type CaptureAction } from './primitives/CapturePlate';
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace=packages/design-system -- CapturePlate`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add CapturePlate — the plate that replaces Card"
```

---

## Task 5: CaptureRow and ActivityRow

**Files:**
- Create: `packages/design-system/src/primitives/CaptureRow.tsx`
- Create: `packages/design-system/src/primitives/ActivityRow.tsx`
- Create: `packages/design-system/src/__tests__/rows.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: `CAPTURE_STATES`, `CaptureStatus` (Task 1); `StateRule`, `StatusBadge` (Task 2); `CaptureAction` (Task 4).
- Produces:
  - `<CaptureRow …>` with `columns?: 9 | 7 | 5` for the responsive ladder
  - `<ActivityRow actor meta event thumbnail action? needsReply? />`

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/rows.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaptureRow } from '../primitives/CaptureRow';
import { ActivityRow } from '../primitives/ActivityRow';

const row = {
  title: 'Sprint 24 release walkthrough',
  kind: 'recording' as const,
  length: '6:38',
  created: '2h ago',
  size: '21.4 MB',
  collection: 'Internal',
  sharing: 'shared' as const,
  activity: '31 views · 4 comments',
};

describe('CaptureRow', () => {
  it('renders nine columns at desktop width', () => {
    render(<CaptureRow {...row} status="shared" columns={9} />);
    expect(screen.getAllByRole('cell')).toHaveLength(9);
  });

  it('drops size and collection at seven columns', () => {
    render(<CaptureRow {...row} status="shared" columns={7} />);
    expect(screen.queryByText('21.4 MB')).toBeNull();
    expect(screen.queryByText('Internal')).toBeNull();
  });

  it('keeps title, type, length, created and status at five columns', () => {
    render(<CaptureRow {...row} status="shared" columns={5} />);
    expect(screen.getByText(row.title)).toBeInTheDocument();
    expect(screen.getByText('6:38')).toBeInTheDocument();
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  it('carries the edge state rule for a failed upload', () => {
    render(<CaptureRow {...row} status="uploadFailed" />);
    expect(screen.getByTestId('state-rule-left')).toBeInTheDocument();
  });

  it('renders metadata in the mono face', () => {
    render(<CaptureRow {...row} status="shared" />);
    expect(screen.getByText('6:38').style.fontFamily).toBe('var(--sr-font-mono)');
  });
});

describe('ActivityRow', () => {
  it('always carries a capture frame — never a bare notification', () => {
    render(<ActivityRow actor="Sam Ortiz" event="asked a question at 0:39" meta="12m ago" />);
    expect(screen.getByTestId('activity-thumb')).toBeInTheDocument();
  });

  it('marks a needs-a-reply row in coral and in words', () => {
    render(<ActivityRow actor="Sam Ortiz" event="asked a question" meta="12m ago" needsReply />);
    expect(screen.getByText('needs a reply')).toBeInTheDocument();
  });

  it('fires its inline action', async () => {
    const open = vi.fn();
    render(
      <ActivityRow actor="Sam Ortiz" event="asked a question" meta="12m ago"
        action={{ label: 'Open and reply', onSelect: open }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open and reply' }));
    expect(open).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- rows`
Expected: FAIL — cannot resolve `../primitives/CaptureRow`.

- [ ] **Step 3: Write CaptureRow**

Create `packages/design-system/src/primitives/CaptureRow.tsx`:

```tsx
import { Icon } from '@iconify/react';
import { CAPTURE_STATES, type CaptureStatus } from '../status';
import { StateRule } from './StateRule';
import { StatusBadge } from './StatusBadge';
import type { CaptureAction } from './CapturePlate';

/** The responsive ladder, from the prototype's RESP scene:
 *  9 → desktop, 7 → 1024–1279 (size and collection drop),
 *  5 → 768–1023 (title, type, length, created, status). Below 768 the list is
 *  the only view and uses a different component — see P3. */
export type RowColumns = 9 | 7 | 5;

export interface CaptureRowProps {
  title: string;
  kind: 'recording' | 'screenshot' | 'fullpage';
  length: string;
  created: string;
  size?: string;
  collection?: string;
  sharing?: 'shared' | 'private';
  activity?: string;
  status: CaptureStatus;
  progress?: number;
  columns?: RowColumns;
  actions?: CaptureAction[];
  selected?: boolean;
  onOpen?: () => void;
  onSelectToggle?: () => void;
}

const KIND_LABEL = { recording: 'recording', screenshot: 'screenshot', fullpage: 'full page' } as const;

const mono = {
  fontFamily: 'var(--sr-font-mono)',
  fontSize: 10.5,
  color: 'var(--sr-text-faint-on-light)',
} as const;

export function CaptureRow({
  title, kind, length, created, size, collection, sharing, activity,
  status, progress, columns = 9, actions = [], selected = false,
  onOpen, onSelectToggle,
}: CaptureRowProps) {
  const def = CAPTURE_STATES[status];
  const show9 = columns === 9;
  const show7 = columns >= 7;

  return (
    <div
      role="row"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: [
          onSelectToggle ? '28px' : null,
          'minmax(0, 3fr)', '90px', '70px', '90px',
          show9 ? '80px' : null,
          show9 ? '110px' : null,
          show7 ? '90px' : null,
          show7 ? '140px' : null,
          actions.length ? '80px' : null,
        ].filter(Boolean).join(' '),
        alignItems: 'center',
        gap: 12,
        height: 'var(--sr-h-row)',
        paddingLeft: 12,
        borderBottom: '1px solid var(--sr-border-light-soft)',
        background: selected ? 'var(--sr-cyan-tint)' : 'transparent',
      }}
    >
      <StateRule status={status} progress={progress} edge="left" />

      {onSelectToggle && def.canSelect && (
        <input type="checkbox" checked={selected} onChange={onSelectToggle}
          aria-label={`Select ${title}`} style={{ accentColor: 'var(--sr-cyan)' }} />
      )}

      <span role="cell" style={{ minWidth: 0 }}>
        <button type="button" onClick={onOpen} style={{
          border: 'none', background: 'transparent', padding: 0, textAlign: 'left',
          fontSize: 13, fontWeight: 500, color: 'var(--sr-text-primary-on-light)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          width: '100%', cursor: onOpen ? 'pointer' : 'default',
        }}>{title}</button>
      </span>

      <span role="cell" style={mono}>{KIND_LABEL[kind]}</span>
      <span role="cell" style={mono}>{length}</span>
      <span role="cell" style={mono}>{created}</span>
      {show9 && <span role="cell" style={mono}>{size}</span>}
      {show9 && <span role="cell" style={mono}>{collection}</span>}
      {show7 && <span role="cell" style={mono}>{sharing}</span>}
      {show7 && <span role="cell" style={mono}>{activity}</span>}

      <span role="cell"><StatusBadge status={def.label as never} /></span>

      {actions.length > 0 && (
        <span role="cell" style={{ display: 'inline-flex', gap: 8 }}>
          {actions.map(a => (
            <button key={a.key} type="button"
              onClick={a.disabledReason ? undefined : a.onSelect}
              aria-disabled={a.disabledReason ? 'true' : undefined}
              title={a.disabledReason ?? a.label} aria-label={a.label}
              style={{ border: 'none', background: 'transparent', padding: 0,
                color: 'var(--sr-text-muted-on-light)', display: 'inline-flex' }}>
              <Icon icon={a.icon} width={14} aria-hidden="true" />
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
```

> The `role="cell"` count in the test counts only the metadata cells plus the
> status cell — nine at desktop. The checkbox and action cluster are not cells.
> If you change the column set, change the test with it.

- [ ] **Step 4: Write ActivityRow**

Create `packages/design-system/src/primitives/ActivityRow.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface ActivityRowProps {
  actor: string;
  event: ReactNode;
  meta: string;
  thumbnail?: ReactNode;
  needsReply?: boolean;
  action?: { label: string; onSelect: () => void };
}

/** 44×26 capture frame + actor/event + inline action. Activity is never a bare
 * notification — the capture it refers to is always visible. */
export function ActivityRow({ actor, event, meta, thumbnail, needsReply, action }: ActivityRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      borderLeft: needsReply ? '2px solid var(--sr-coral-text)' : '2px solid transparent',
      background: 'var(--sr-surface-paper)', padding: '11px 14px',
    }}>
      {needsReply && (
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          letterSpacing: '.1em', color: 'var(--sr-coral-hover)', whiteSpace: 'nowrap',
        }}>needs a reply</span>
      )}

      <span data-testid="activity-thumb" style={{
        width: 44, height: 26, flex: 'none',
        background: 'var(--sr-surface-carbon)', position: 'relative', overflow: 'hidden',
      }}>{thumbnail}</span>

      <span style={{ fontSize: 13.5, flex: 1, color: 'var(--sr-text-primary-on-light)' }}>
        <strong style={{ fontWeight: 600 }}>{actor}</strong> {event}
      </span>

      <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 10, color: 'var(--sr-text-faint-on-light)' }}>
        {meta}
      </span>

      {action && (
        <button type="button" onClick={action.onSelect} style={{
          height: 'var(--sr-h-2xs)', padding: '0 13px',
          border: '1px solid var(--sr-text-primary-on-light)', background: 'transparent',
          color: 'var(--sr-text-primary-on-light)', fontSize: 12.5, fontWeight: 500,
          borderRadius: 'var(--sr-radius-control)', cursor: 'pointer',
        }}>{action.label}</button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Export both**

Add to `packages/design-system/src/index.ts`:

```ts
export { CaptureRow, type CaptureRowProps, type RowColumns } from './primitives/CaptureRow';
export { ActivityRow, type ActivityRowProps } from './primitives/ActivityRow';
```

- [ ] **Step 6: Run the tests**

Run: `npm test --workspace=packages/design-system -- rows`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add CaptureRow and ActivityRow"
```

---

## Task 6: Extend PathSpine with failure, offline and queued treatments

**Files:**
- Modify: `packages/design-system/src/primitives/PathSpine.tsx`
- Modify: `packages/design-system/src/__tests__/status.test.tsx`

**Interfaces:**
- Consumes: `PATH_NODES`, `PathState` (already exist).
- Produces: `<PathSpine current={0..3} state={PathState} progress?={number} breakAt?={number} />`

The prototype's B1–B6 sequence needs four spine treatments, not one: solid
(in progress), filled (done), dashed (pending/offline), and broken with a tick
(failed). P0 shipped only the first two.

- [ ] **Step 1: Write the failing test**

Append to `packages/design-system/src/__tests__/status.test.tsx`:

```tsx
import { PathSpine } from '../primitives/PathSpine';

describe('PathSpine treatments', () => {
  it('fills completed nodes in green — the only place green appears', () => {
    render(<PathSpine current={2} state="normal" />);
    const done = screen.getAllByTestId('spine-node').slice(0, 2);
    for (const n of done) expect(n.style.background).toBe('var(--sr-green)');
  });

  it('draws a tick at the break point when the upload failed', () => {
    render(<PathSpine current={1} state="failed" breakAt={62} />);
    const tick = screen.getByTestId('spine-break');
    expect(tick).toHaveStyle({ left: '62%' });
    expect(tick.style.background).toBe('var(--sr-coral-text)');
  });

  it('draws offline as dashed grey, never coral', () => {
    render(<PathSpine current={1} state="offline" />);
    const seg = screen.getByTestId('spine-segment-1');
    expect(seg.style.backgroundImage).toContain('repeating-linear-gradient');
    expect(seg.style.background).not.toContain('coral');
  });

  it('is a progressbar with a live value', () => {
    render(<PathSpine current={1} state="normal" progress={62} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '62');
  });

  it('names each node in words as well as treatment', () => {
    render(<PathSpine current={1} state="normal" />);
    expect(screen.getByText('on this device')).toBeInTheDocument();
    expect(screen.getByText('link ready')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- status`
Expected: FAIL — no `spine-break` testid, `state` prop unsupported.

- [ ] **Step 3: Rewrite PathSpine**

Replace `packages/design-system/src/primitives/PathSpine.tsx`:

```tsx
import { PATH_NODES, type PathState } from '../status';

export interface PathSpineProps {
  /** Index of the node currently being entered, 0–3. Nodes below it are done. */
  current: number;
  state?: PathState;
  /** 0–100 within the current node, for determinate work. */
  progress?: number;
  /** 0–100 position of the failure tick along the current segment. */
  breakAt?: number;
}

/** Four nodes, always in the same order. Reused three ways: as the upload
 * progress bar, as the completion surface's spine, and as the library card's
 * status line. Green marks a completed node; hollow marks one not yet entered.
 *
 * Treatments: solid cyan = in progress · green = done · dashed grey = pending
 * or queued · coral with a tick = stopped. */
export function PathSpine({ current, state = 'normal', progress, breakAt }: PathSpineProps) {
  const failed = state === 'failed';
  const dashed = state === 'offline' || state === 'queued';

  const segmentBackground = (i: number) => {
    if (i < current) return 'var(--sr-green)';
    if (i > current) return 'var(--sr-border-light)';
    if (failed) return 'var(--sr-coral-text)';
    if (dashed) return 'transparent';
    return 'var(--sr-cyan)';
  };

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress ?? Math.round((current / PATH_NODES.length) * 100)}
      aria-valuetext={`${PATH_NODES[Math.min(current, PATH_NODES.length - 1)]}${failed ? ' — stopped' : ''}`}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${PATH_NODES.length}, 1fr)`, gap: 2 }}
    >
      {PATH_NODES.map((node, i) => (
        <div key={node} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ position: 'relative', height: 3, background: 'var(--sr-border-light-soft)' }}>
            <span
              data-testid={`spine-segment-${i}`}
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: i < current ? '100%' : i > current ? '0%' : `${progress ?? 100}%`,
                background: segmentBackground(i),
                backgroundImage: dashed && i === current
                  ? 'repeating-linear-gradient(90deg, var(--sr-text-faint-on-light) 0 5px, transparent 5px 10px)'
                  : undefined,
                transition: 'width var(--sr-dur-slow) var(--sr-ease)',
              }}
            />
            {failed && i === current && breakAt != null && (
              <span
                data-testid="spine-break"
                aria-hidden="true"
                style={{
                  position: 'absolute', left: `${breakAt}%`, top: -3,
                  width: 2, height: 9, background: 'var(--sr-coral-text)',
                }}
              />
            )}
          </div>

          <span
            data-testid="spine-node"
            style={{
              width: 7, height: 7,
              background: i < current ? 'var(--sr-green)' : 'transparent',
              border: `1px solid ${i <= current ? 'var(--sr-cyan)' : 'var(--sr-border-light)'}`,
            }}
          />

          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
            color: i <= current ? 'var(--sr-text-muted-on-light)' : 'var(--sr-text-faint-on-light)',
          }}>{node}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test --workspace=packages/design-system`
Expected: PASS. If a P0 assertion about the old spine markup breaks, update it —
the new markup is authoritative.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): extend PathSpine with failed, offline and queued treatments"
```

---

## Task 7: SelectionBar

**Files:**
- Create: `packages/design-system/src/primitives/SelectionBar.tsx`
- Create: `packages/design-system/src/__tests__/SelectionBar.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: `CaptureAction` (Task 4).
- Produces: `<SelectionBar count total onClear actions destructive />`

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/SelectionBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionBar } from '../primitives/SelectionBar';

const actions = [
  { key: 'download', label: 'Download', icon: 'ant-design:download-outlined', onSelect: () => {} },
  { key: 'move', label: 'Move to collection', icon: 'ant-design:folder-outlined', onSelect: () => {} },
];

describe('SelectionBar', () => {
  it('states the count in words', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions}
      destructive={{ key: 'delete', label: 'Delete', icon: 'ant-design:delete-outlined', onSelect: () => {} }} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('separates the destructive action from the rest', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions}
      destructive={{ key: 'delete', label: 'Delete', icon: 'ant-design:delete-outlined', onSelect: () => {} }} />);
    expect(screen.getByTestId('destructive-slot')).toBeInTheDocument();
  });

  it('never renders the destructive action coral-filled', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={actions}
      destructive={{ key: 'delete', label: 'Delete', icon: 'ant-design:delete-outlined', onSelect: () => {} }} />);
    expect(screen.getByRole('button', { name: 'Delete' }).style.background).toBe('transparent');
  });

  it('gives a disabled bulk action its reason', () => {
    render(<SelectionBar count={3} total={128} onClear={() => {}} actions={[
      { key: 'share', label: 'Share', icon: 'ant-design:link-outlined', onSelect: () => {},
        disabledReason: '2 of these are still uploading' },
    ]} />);
    expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute('title', '2 of these are still uploading');
  });

  it('clears the selection', async () => {
    const clear = vi.fn();
    render(<SelectionBar count={3} total={128} onClear={clear} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(clear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- SelectionBar`
Expected: FAIL — cannot resolve `../primitives/SelectionBar`.

- [ ] **Step 3: Write the implementation**

Create `packages/design-system/src/primitives/SelectionBar.tsx`:

```tsx
import { Icon } from '@iconify/react';
import type { CaptureAction } from './CapturePlate';

export interface SelectionBarProps {
  count: number;
  total: number;
  onClear: () => void;
  actions: CaptureAction[];
  /** Rendered in a separated slot at the right. Never coral-filled. */
  destructive?: CaptureAction;
}

const btn = {
  height: 'var(--sr-h-2xs)',
  padding: '0 12px',
  background: 'transparent',
  borderRadius: 'var(--sr-radius-control)',
  fontSize: 12.5,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  cursor: 'pointer',
} as const;

/** Carbon bulk toolbar. Two rules it exists to enforce: every disabled action
 * says why, and the destructive action is separated rather than merely coloured. */
export function SelectionBar({ count, total, onClear, actions, destructive }: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} of ${total} selected`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 46, padding: '0 14px',
        background: 'var(--sr-surface-carbon)', color: 'var(--sr-text-primary-on-dark)',
      }}
    >
      <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 11.5 }}>{count} selected</span>

      <button type="button" onClick={onClear} aria-label="Clear selection" style={{
        ...btn, border: '1px solid var(--sr-border-dark)', color: 'var(--sr-text-secondary-on-dark)',
      }}>
        <Icon icon="ant-design:close-outlined" width={11} aria-hidden="true" />
      </button>

      <span style={{ flex: 1 }} />

      {actions.map(a => (
        <button key={a.key} type="button"
          onClick={a.disabledReason ? undefined : a.onSelect}
          aria-disabled={a.disabledReason ? 'true' : undefined}
          title={a.disabledReason ?? a.label}
          style={{
            ...btn,
            border: '1px solid var(--sr-border-dark)',
            color: a.disabledReason ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-text-primary-on-dark)',
            cursor: a.disabledReason ? 'not-allowed' : 'pointer',
          }}>
          <Icon icon={a.icon} width={13} aria-hidden="true" />{a.label}
        </button>
      ))}

      {destructive && (
        <span data-testid="destructive-slot" style={{
          marginLeft: 18, paddingLeft: 18, borderLeft: '1px solid var(--sr-border-dark)',
        }}>
          <button type="button" onClick={destructive.onSelect} style={{
            ...btn,
            border: '1px solid var(--sr-coral-text)',
            color: 'var(--sr-coral-on-dark)',
          }}>
            <Icon icon={destructive.icon} width={13} aria-hidden="true" />{destructive.label}
          </button>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Export it**

Add to `packages/design-system/src/index.ts`:

```ts
export { SelectionBar, type SelectionBarProps } from './primitives/SelectionBar';
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace=packages/design-system -- SelectionBar`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add SelectionBar with separated destructive slot"
```

---

## Task 8: AppRail

**Files:**
- Create: `packages/design-system/src/primitives/AppRail.tsx`
- Create: `packages/design-system/src/__tests__/AppRail.test.tsx`
- Modify: `packages/design-system/src/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  interface RailItem { key: string; label: string; icon: string; onSelect: () => void }
  interface AppRailProps {
    items: RailItem[];
    current: string;
    extension: 'on' | 'off' | 'unknown';
    onExtensionClick?: () => void;
    user: { initials: string; name: string };
    onUserClick?: () => void;
    collapsed?: boolean;   // 56px, labels become tooltips
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/src/__tests__/AppRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRail } from '../primitives/AppRail';

const items = [
  { key: 'home', label: 'Home', icon: 'ant-design:home-outlined', onSelect: () => {} },
  { key: 'library', label: 'Library', icon: 'ant-design:appstore-outlined', onSelect: () => {} },
];
const user = { initials: 'PR', name: 'Priya Raman' };

describe('AppRail', () => {
  it('is 68px wide by default', () => {
    render(<AppRail items={items} current="home" extension="on" user={user} />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveStyle({ width: '68px' });
  });

  it('collapses to 56px and drops labels to tooltips', () => {
    render(<AppRail items={items} current="home" extension="on" user={user} collapsed />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveStyle({ width: '56px' });
    expect(screen.queryByText('Library')).toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('title', 'Library');
  });

  it('marks the current item for assistive tech, not only in cyan', () => {
    render(<AppRail items={items} current="library" extension="on" user={user} />);
    expect(screen.getByRole('button', { name: /Library/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Home/ })).not.toHaveAttribute('aria-current', 'page');
  });

  it('states extension connectivity in words', () => {
    const { rerender } = render(<AppRail items={items} current="home" extension="on" user={user} />);
    expect(screen.getByText('on')).toBeInTheDocument();
    rerender(<AppRail items={items} current="home" extension="off" user={user} />);
    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('navigates on click', async () => {
    const go = vi.fn();
    render(<AppRail items={[{ ...items[0], onSelect: go }]} current="library" extension="on" user={user} />);
    await userEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(go).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=packages/design-system -- AppRail`
Expected: FAIL — cannot resolve `../primitives/AppRail`.

- [ ] **Step 3: Write the implementation**

Create `packages/design-system/src/primitives/AppRail.tsx`:

```tsx
import { Icon } from '@iconify/react';
import { Logo } from './Logo';

export interface RailItem {
  key: string;
  label: string;
  icon: string;
  onSelect: () => void;
}

export interface AppRailProps {
  items: RailItem[];
  current: string;
  extension: 'on' | 'off' | 'unknown';
  onExtensionClick?: () => void;
  user: { initials: string; name: string };
  onUserClick?: () => void;
  /** 56px with labels dropped to tooltips — 1024–1279 only. */
  collapsed?: boolean;
}

const EXT_TONE = {
  on: 'var(--sr-cyan)',
  off: 'var(--sr-coral-on-dark)',
  unknown: 'var(--sr-text-faint-on-dark)',
} as const;

/** 68px carbon navigation. The cyan mark sits on the leading edge of the active
 * item — the mobile bottom bar puts the same mark on top. */
export function AppRail({
  items, current, extension, onExtensionClick, user, onUserClick, collapsed = false,
}: AppRailProps) {
  return (
    <nav
      aria-label="Main"
      style={{
        width: collapsed ? 56 : 68,
        flex: 'none',
        background: 'var(--sr-surface-carbon)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0 14px',
      }}
    >
      <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
        <Logo size={18} markOnly />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {items.map(item => {
          const active = item.key === current;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onSelect}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              style={{
                position: 'relative',
                border: 'none',
                background: active ? 'var(--sr-surface-panel-dark)' : 'transparent',
                color: active ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
                height: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                transition: 'color var(--sr-dur-fast) var(--sr-ease)',
              }}
            >
              <span aria-hidden="true" style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                background: active ? 'var(--sr-cyan)' : 'transparent',
              }} />
              <Icon icon={item.icon} width={18} aria-hidden="true" />
              {!collapsed && <span style={{ fontSize: 9.5, letterSpacing: '.01em' }}>{item.label}</span>}
            </button>
          );
        })}
      </div>

      <span style={{ flex: 1 }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={onExtensionClick}
          title={`Extension ${extension}`}
          aria-label={`Extension ${extension}`}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontFamily: 'var(--sr-font-mono)', fontSize: 8.5, color: EXT_TONE[extension],
          }}
        >
          <Icon icon="ant-design:api-outlined" width={16} aria-hidden="true" />
          {extension}
        </button>

        <button
          type="button"
          onClick={onUserClick}
          title={user.name}
          aria-label={user.name}
          style={{
            width: 28, height: 28, border: 'none',
            background: 'var(--sr-text-primary-on-dark)', color: 'var(--sr-surface-carbon)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{user.initials}</button>
      </div>
    </nav>
  );
}
```

> **If `Logo` has no `markOnly` prop:** add one. It renders the two cyan corner
> arms and the coral square without the wordmark, at the given `size`. The rail
> has no room for the wordmark.

- [ ] **Step 4: Export it**

Add to `packages/design-system/src/index.ts`:

```ts
export { AppRail, type AppRailProps, type RailItem } from './primitives/AppRail';
```

- [ ] **Step 5: Run the tests**

Run: `npm test --workspace=packages/design-system`
Expected: PASS, all suites.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(ds): add AppRail"
```

---

## Task 9: Test infrastructure for apps/web, and the no-hex gate

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/__tests__/setup.ts`
- Modify: `apps/web/package.json`
- Create: `packages/design-system/src/__tests__/no-hex.test.ts`
- Create: `docs/design-system.md`

**Interfaces:**
- Consumes: everything built in Tasks 1–8.
- Produces: `npm run test --workspace=apps/web` — the harness P3–P6 depend on.

- [ ] **Step 1: Write the failing hex-literal test**

Create `packages/design-system/src/__tests__/no-hex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRIMITIVES = resolve(__dirname, '../primitives');

describe('primitives never hardcode colour', () => {
  it('contains no hex literal outside tokens.css', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(PRIMITIVES)) {
      const src = readFileSync(resolve(PRIMITIVES, file), 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and fix what it catches**

Run: `npm test --workspace=packages/design-system -- no-hex`
Expected: FAIL on `StatusBadge.tsx` — the P0 `StatusChip` used a literal `#fff`
for the recording dot, and Task 2 carried it over.

Fix: in `StatusBadge.tsx`, change the recording dot's `background` to
`'var(--sr-coral-mark)'` and delete the `#fff` branch. Re-run until green.

- [ ] **Step 3: Add Vitest to apps/web**

Add to `apps/web/package.json` under `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Add to `devDependencies`:

```json
"@testing-library/jest-dom": "^6.6.3",
"@testing-library/react": "^16.1.0",
"@testing-library/user-event": "^14.5.2",
"jsdom": "^25.0.1",
"vitest": "^3.0.0"
```

Then: `npm install`

- [ ] **Step 4: Configure it**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Create `apps/web/src/__tests__/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// The design system reads custom properties that jsdom does not resolve.
// Assertions compare the var() expression itself, so nothing needs stubbing —
// but matchMedia is used by the responsive hooks in P3 and must exist.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

- [ ] **Step 5: Prove the harness works**

Create `apps/web/src/__tests__/harness.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapturePlate } from '@snaprec/design-system';

describe('web test harness', () => {
  it('renders a design-system component', () => {
    render(<CapturePlate title="Test" meta="recording · now" kind="recording" status="ready" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
```

Run: `npm run test --workspace=apps/web`
Expected: PASS, 1 test.

- [ ] **Step 6: Document the layer**

Create `docs/design-system.md`:

```markdown
# Design system

`packages/design-system` is the plate visual language. `src/tokens.css` is the
single source of truth — a hex literal anywhere else is a bug, enforced by
`__tests__/no-hex.test.ts`.

## Primitives

**P0 — controls and surfaces**
Button · IconButton · Frame · Logo · SegmentedControl · Switch · Mono · Field

**P1 — the capture vocabulary**
CapturePlate · CaptureRow · CaptureFrame · StateRule · StatusBadge ·
ActivityRow · SelectionBar · AppRail · PathSpine

## The capture state model

`src/status.ts` holds `CAPTURE_STATES` — thirteen states, each carrying its
label, rule treatment, primary action and capability flags. **Every surface
reads this record.** No page decides for itself what `uploading` looks like or
whether a processing capture can be shared.

Adding a state means adding it here first, then to `STATUS_WORDS`, then letting
the tests tell you which surfaces need updating.

## What is deliberately absent

- **No Card.** `CapturePlate` replaces it. If you find yourself writing a card,
  you are working around the state model.
- **No filled status pills.** `StatusBadge` is outlined at 19px.
- **No `dark:` utilities.** Dark is a surface prop, not a theme.
- **No solid handles** outside the video editor's trim points.

## Testing

    npm test --workspace=packages/design-system
    npm run test --workspace=apps/web

The contrast suite parses `tokens.css` and fails if any text pair drops below
WCAG AA. It is why `--sr-text-faint-on-light` is `#656E71` rather than the
prototype's `#8D989B`, which measures 2.86:1 on paper. Do not relax it to match
a mockup.
```

- [ ] **Step 7: Run everything**

Run: `npm test --workspace=packages/design-system && npm run test --workspace=apps/web && npm run build --workspace=apps/web`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/__tests__ apps/web/package.json package-lock.json packages/design-system/src docs/design-system.md
git commit -m "feat: add web test harness, no-hex gate, and design-system docs"
```

---

## Exit criteria

- `npm test --workspace=packages/design-system` — all suites pass, including the
  contrast gate and the new no-hex gate.
- `npm run test --workspace=apps/web` — the harness renders a design-system
  component.
- `npm run build --workspace=apps/web` — succeeds.
- No user-visible change has shipped. That is correct: P1 is the vocabulary
  P2–P6 speak.
