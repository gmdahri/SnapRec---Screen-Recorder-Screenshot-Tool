import '@testing-library/jest-dom/vitest';

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
