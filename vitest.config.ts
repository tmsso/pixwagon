import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Still no DOM environment: the component tests we do have render through
    // `react-dom/server` (`renderToStaticMarkup`) and assert on the HTML string,
    // the same technique `scripts/check-screens.tsx` uses — enough to lock copy
    // and structural states without pulling in jsdom + a testing-library.
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
  },
});
