// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // ── Path aliases matching tsconfig ────────────────────────
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // ── Coverage ───────────────────────────────────────────────
  collectCoverageFrom: [
    'store/**/*.ts',
    'hooks/**/*.ts',
    'utils/**/*.ts',
    'types/**/*.ts',
    'components/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageThreshold: {
    global: {
      branches:   70,
      functions:  80,
      lines:      80,
      statements: 80,
    },
  },

  // ── Test file patterns ─────────────────────────────────────
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],

  // ── Ignore E2E folder in unit test run ─────────────────────
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
  ],
};

export default createJestConfig(config);