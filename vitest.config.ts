import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/core', 'apps/worker'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      reporter: ['text', 'html'],
      // docs/07-plan-prac.md M1: 100% coverage of the pricing engine and geometry.
      thresholds: {
        'packages/core/src/{pricing,geometry}.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
