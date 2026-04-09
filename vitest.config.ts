import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/tests/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/tests/**', 'node_modules'],
      reportOnFailure: true,
    },
  },
});
