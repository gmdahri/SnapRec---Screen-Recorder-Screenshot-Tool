/** The fixed vocabulary. These strings are never paraphrased anywhere in the product.
 *
 * P0 shipped nine words from spec §3. The standalone prototypes' capture item
 * model (file 03, scene MODEL) needs eight more. This is the union; nothing may
 * be added without a corresponding entry in CAPTURE_STATES or a chip usage. */
export type CaptureKind = 'recording' | 'screenshot' | 'fullpage';

/** What each kind of capture is called, in the one phrasing it ever gets.
 *
 * CaptureRow and CapturePlate each kept a private copy of this map and they had
 * already drifted — one said "screenshot", the other "Screenshot" — which is
 * precisely the paraphrasing this file exists to prevent. Lower case, because
 * the plate's own meta line and every StatusBadge beside it are lower case. */
export const KIND_LABEL: Record<CaptureKind, string> = {
  recording: 'recording',
  screenshot: 'screenshot',
  fullpage: 'full page',
};

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
  /** The word shown to the user. Always a StatusWord, optionally suffixed with
   * a percentage — the status test enforces that the bare label is in the
   * vocabulary. */
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
