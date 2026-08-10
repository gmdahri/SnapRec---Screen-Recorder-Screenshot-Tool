import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { vi } from 'vitest';

/** @iconify/react resolves icon data asynchronously and pushes the result into
 * component state from a timer. In jsdom that timer routinely outlives the test
 * that mounted it, and firing after teardown throws "window is not defined" as
 * an unhandled error — which vitest warns can produce false positives.
 *
 * Nothing here asserts on icon glyphs; they are found by aria-label or title.
 * So icons render synchronously as a marked span and the timer never exists. */
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...rest }: { icon: string; [key: string]: unknown }) =>
    createElement('span', { 'data-icon': icon, ...rest }),
}));

/** jsdom does not resolve CSS custom properties, so assertions compare the
 * `var(--sr-*)` expression itself — nothing needs stubbing there.
 *
 * matchMedia does need a stub: useBreakpoint and the sheet components call it,
 * and jsdom ships no implementation at all. */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
