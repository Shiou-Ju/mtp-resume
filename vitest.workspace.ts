import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Core package tests
  {
    test: {
      name: 'core',
      root: './packages/core',
      environment: 'node',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
    },
  },
  // CLI package tests
  {
    test: {
      name: 'cli',
      root: './packages/cli',
      environment: 'node',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
    },
  },
])