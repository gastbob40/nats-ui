import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          setupFiles: ['./tests/support/unit-setup.ts'],
          include: ['tests/unit/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['./tests/support/vitest-global-setup.ts'],
          testTimeout: 15_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Pragmatic scope: the logic-bearing modules. Pages and UI components
      // are exercised end-to-end by Playwright, whose coverage is not merged
      // here (yet) — see tests/e2e for the use-case checklist.
      include: [
        'src/services/**',
        'src/lib/**',
        'src/hooks/**',
        'src/contexts/**',
        'src/config/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
