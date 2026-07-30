import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Phase 0 tests are all pure (RNG, schema, protocol decoding), so no DOM
    // environment is needed. Component tests arrive with Phase 2.
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
});
