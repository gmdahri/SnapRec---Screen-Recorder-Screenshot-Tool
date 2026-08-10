import { CAPTURE_STATES, type CaptureStatus } from '@snaprec/design-system';

/** One state machine behind three presentations — desktop grid, desktop list
 * and mobile list. They differ in layout only; filtering, sorting and selection
 * must behave identically or the same query gives different answers on a
 * narrower screen. */

export type CaptureKind = 'recording' | 'screenshot' | 'fullpage';

export interface LibraryItem {
  id: string;
  title: string;
  kind: CaptureKind;
  status: CaptureStatus;
  createdAt: number;
  sizeBytes: number;
  collection: string | null;
}

export interface LibraryFilters {
  type: 'all' | 'recordings' | 'screenshots';
  sharing: 'all' | 'shared' | 'private';
  collection: string | null;
  dateRange: 'all' | '7d' | '30d' | '90d';
  query: string;
}

export type SortKey = 'newest' | 'oldest' | 'name' | 'size' | 'views';

export interface LibraryView {
  mode: 'grid' | 'list';
  sort: SortKey;
  filters: LibraryFilters;
  selected: Set<string>;
}

export type LibraryAction =
  | { type: 'SET_MODE'; mode: LibraryView['mode'] }
  | { type: 'SET_SORT'; sort: SortKey }
  | { type: 'SET_FILTER'; key: keyof Omit<LibraryFilters, 'query'>; value: string | null }
  | { type: 'SET_QUERY'; value: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'TOGGLE_SELECT'; id: string; status: CaptureStatus }
  | { type: 'CLEAR_SELECTION' };

const EMPTY_FILTERS: LibraryFilters = {
  type: 'all',
  sharing: 'all',
  collection: null,
  dateRange: 'all',
  query: '',
};

export function initialView(): LibraryView {
  return { mode: 'grid', sort: 'newest', filters: { ...EMPTY_FILTERS }, selected: new Set() };
}

export function reduce(view: LibraryView, action: LibraryAction): LibraryView {
  switch (action.type) {
    case 'SET_MODE':
      return { ...view, mode: action.mode };

    case 'SET_SORT':
      return { ...view, sort: action.sort };

    // Any change to what is visible drops the selection: the selected items
    // may no longer be on screen, and acting on invisible items is a trap.
    case 'SET_FILTER':
      return {
        ...view,
        filters: { ...view.filters, [action.key]: action.value },
        selected: new Set(),
      };

    case 'SET_QUERY':
      return { ...view, filters: { ...view.filters, query: action.value }, selected: new Set() };

    case 'CLEAR_FILTERS':
      return { ...view, filters: { ...EMPTY_FILTERS }, selected: new Set() };

    case 'TOGGLE_SELECT': {
      // The state model decides what is selectable, not the page.
      if (!CAPTURE_STATES[action.status].canSelect) return view;
      const selected = new Set(view.selected);
      if (selected.has(action.id)) selected.delete(action.id);
      else selected.add(action.id);
      return { ...view, selected };
    }

    case 'CLEAR_SELECTION':
      return { ...view, selected: new Set() };

    default:
      return view;
  }
}

const DAY_MS = 86_400_000;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

export function applyFilters<T extends LibraryItem>(items: T[], f: LibraryFilters, now = Date.now()): T[] {
  return items.filter(item => {
    if (f.type === 'recordings' && item.kind !== 'recording') return false;
    if (f.type === 'screenshots' && item.kind === 'recording') return false;

    if (f.sharing === 'shared' && item.status !== 'shared') return false;
    if (f.sharing === 'private' && item.status === 'shared') return false;

    if (f.collection !== null && item.collection !== f.collection) return false;

    if (f.dateRange !== 'all' && now - item.createdAt > RANGE_DAYS[f.dateRange] * DAY_MS) return false;

    if (f.query && !item.title.toLowerCase().includes(f.query.toLowerCase())) return false;

    return true;
  });
}

const CHIP_ORDER: (keyof Omit<LibraryFilters, 'query'>)[] =
  ['type', 'sharing', 'collection', 'dateRange'];

const CHIP_LABEL: Record<string, string> = {
  recordings: 'Recordings',
  screenshots: 'Screenshots',
  shared: 'Shared',
  private: 'Private',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/** Only non-default values become chips, in a fixed order — a chip row that
 * reorders itself as you filter is unreadable. */
export function activeFilterChips(f: LibraryFilters): { key: string; label: string }[] {
  return CHIP_ORDER.flatMap(key => {
    const value = f[key];
    if (value === null || value === 'all') return [];
    return [{ key, label: CHIP_LABEL[value as string] ?? String(value) }];
  });
}

export interface SelectionCapability {
  canShare: string | true;
  canDownload: string | true;
  canDelete: string | true;
}

/** Returns `true` or the sentence explaining why not — never `false`.
 *
 * A disabled bulk action with no reason is a dead end, and "why is Share
 * greyed out" is the single most common question a multi-select produces. */
export function selectionCapability(
  items: LibraryItem[], selected: Set<string>,
): SelectionCapability {
  const chosen = items.filter(i => selected.has(i.id));

  const uploading = chosen.filter(i => i.status === 'uploading' || i.status === 'queuedOffline');
  const unshareable = chosen.filter(i => !CAPTURE_STATES[i.status].canShare);
  const noMedia = chosen.filter(i => !CAPTURE_STATES[i.status].canPreview);

  const count = (n: number, verb: string) =>
    `${n} of these ${n === 1 ? 'is' : 'are'} ${verb}`;

  return {
    canShare: unshareable.length === 0
      ? true
      : uploading.length > 0
        ? count(uploading.length, 'still uploading')
        : count(unshareable.length, 'not uploaded yet'),

    canDownload: noMedia.length === 0 ? true : count(noMedia.length, 'still processing'),

    canDelete: uploading.length === 0 ? true : count(uploading.length, 'still uploading'),
  };
}
