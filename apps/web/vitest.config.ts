import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Tailwind v4's PostCSS plugin is not needed to assert on inline styles,
    // and loading it here costs ~2s per run for nothing.
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
