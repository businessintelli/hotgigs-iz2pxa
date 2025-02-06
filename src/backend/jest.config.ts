import type { Config } from 'jest'; // jest ^29.6.0

/**
 * Jest configuration for HotGigs backend services
 * Configures test environment, coverage reporting, and TypeScript integration
 * for comprehensive testing of Edge Functions and backend services
 */
const config: Config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define root directory for tests
  roots: ['<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Path aliases mapping for imports
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@types/(.*)': '<rootDir>/src/types/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@services/(.*)': '<rootDir>/src/services/$1',
    '@middleware/(.*)': '<rootDir>/src/middleware/$1',
    '@db/(.*)': '<rootDir>/src/db/$1'
  },

  // Test setup file
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],

  // Reset mocks before each test
  clearMocks: true,

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/mocks/'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },

  // Test execution configuration
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%'
};

export default config;