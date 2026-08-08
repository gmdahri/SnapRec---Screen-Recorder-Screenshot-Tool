import { useSyncExternalStore } from 'react';

/** The four rungs, from the prototype's RESP scene.
 *
 * Every responsive decision in the app reads this. No component carries its own
 * media query, because the grid, the list columns and the touch targets have to
 * step together — a 3-column grid with 9-column rows is a layout nobody
 * designed. */
export type Breakpoint = 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop';

export const BREAKPOINTS: Record<Breakpoint, number> = {
  mobile: 0,
  tabletPortrait: 768,
  tabletLandscape: 1024,
  desktop: 1280,
};

const DESCENDING: Breakpoint[] = ['desktop', 'tabletLandscape', 'tabletPortrait', 'mobile'];

function current(): Breakpoint {
  const width = typeof window === 'undefined' ? BREAKPOINTS.desktop : window.innerWidth;
  return DESCENDING.find(bp => width >= BREAKPOINTS[bp]) ?? 'mobile';
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export function useBreakpoint(): Breakpoint {
  // Server snapshot is 'desktop': the prerenderer runs at desktop width, and
  // hydrating into a mobile layout it never rendered would flash.
  return useSyncExternalStore(subscribe, current, () => 'desktop');
}

/** 0 means the grid is abandoned entirely. Below 768 a two-up grid gives 180px
 * plates with unreadable metadata, so the list becomes the only view. */
export function gridColumns(bp: Breakpoint): number {
  return { desktop: 4, tabletLandscape: 3, tabletPortrait: 2, mobile: 0 }[bp];
}

export function rowColumns(bp: Breakpoint): 9 | 7 | 5 {
  return { desktop: 9, tabletLandscape: 7, tabletPortrait: 5, mobile: 5 }[bp] as 9 | 7 | 5;
}

export function touchTarget(bp: Breakpoint): number {
  return { desktop: 32, tabletLandscape: 32, tabletPortrait: 40, mobile: 44 }[bp];
}
