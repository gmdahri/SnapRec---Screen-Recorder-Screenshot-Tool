import { describe, expect, it } from 'vitest';
import {
  activeFilterChips, applyFilters, initialView, reduce, selectionCapability,
  type LibraryItem,
} from '../useLibraryView';

const items: LibraryItem[] = [
  { id: 'a', title: 'Checkout bug', kind: 'recording', status: 'shared', createdAt: 5, sizeBytes: 100, collection: 'Bug reports' },
  { id: 'b', title: 'Pricing page', kind: 'screenshot', status: 'savedPrivately', createdAt: 4, sizeBytes: 200, collection: null },
  { id: 'c', title: 'Sprint demo', kind: 'recording', status: 'uploading', createdAt: 3, sizeBytes: 300, collection: 'Internal' },
];

describe('library view', () => {
  it('starts as a grid sorted newest first with nothing filtered', () => {
    const v = initialView();
    expect(v.mode).toBe('grid');
    expect(v.sort).toBe('newest');
    expect(v.filters.type).toBe('all');
    expect(v.selected.size).toBe(0);
  });

  it('filters by type', () => {
    const v = reduce(initialView(), { type: 'SET_FILTER', key: 'type', value: 'screenshots' });
    expect(applyFilters(items, v.filters).map(i => i.id)).toEqual(['b']);
  });

  it('matches the query case-insensitively on the title', () => {
    const v = reduce(initialView(), { type: 'SET_QUERY', value: 'CHECKOUT' });
    expect(applyFilters(items, v.filters).map(i => i.id)).toEqual(['a']);
  });

  it('exposes one chip per active filter, and none when nothing is set', () => {
    expect(activeFilterChips(initialView().filters)).toEqual([]);
    let v = reduce(initialView(), { type: 'SET_FILTER', key: 'type', value: 'recordings' });
    v = reduce(v, { type: 'SET_FILTER', key: 'dateRange', value: '30d' });
    expect(activeFilterChips(v.filters).map(c => c.key)).toEqual(['type', 'dateRange']);
  });

  it('clears every filter at once', () => {
    let v = reduce(initialView(), { type: 'SET_FILTER', key: 'type', value: 'recordings' });
    v = reduce(v, { type: 'CLEAR_FILTERS' });
    expect(activeFilterChips(v.filters)).toEqual([]);
  });

  it('refuses to select an item whose state forbids it', () => {
    const v = reduce(initialView(), { type: 'TOGGLE_SELECT', id: 'c', status: 'uploading' });
    expect(v.selected.size).toBe(0);
  });

  it('selects an item whose state permits it', () => {
    const v = reduce(initialView(), { type: 'TOGGLE_SELECT', id: 'a', status: 'shared' });
    expect([...v.selected]).toEqual(['a']);
  });

  it('gives a reason when a bulk action is unavailable', () => {
    const caps = selectionCapability(
      [items[0], { ...items[1], status: 'uploading' }], new Set(['a', 'b']));
    expect(caps.canShare).toBe('1 of these is still uploading');
  });

  it('pluralises the reason correctly', () => {
    const caps = selectionCapability(
      [{ ...items[0], status: 'uploading' }, { ...items[1], status: 'uploading' }],
      new Set(['a', 'b']));
    expect(caps.canShare).toBe('2 of these are still uploading');
  });

  it('permits a bulk action when every selected item allows it', () => {
    expect(selectionCapability([items[0], items[1]], new Set(['a', 'b'])).canShare).toBe(true);
  });

  it('clears the selection when the filters change — the items may be gone', () => {
    let v = reduce(initialView(), { type: 'TOGGLE_SELECT', id: 'a', status: 'shared' });
    v = reduce(v, { type: 'SET_FILTER', key: 'type', value: 'screenshots' });
    expect(v.selected.size).toBe(0);
  });
});
