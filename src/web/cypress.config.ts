import { defineConfig } from 'cypress'; // ^13.0.0

export default defineConfig({
  // E2E Testing Configuration
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'src/tests/e2e/**/*.spec.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    video: true,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2, // Retry failed tests twice in CI
      openMode: 0  // No retries in interactive mode
    },
    setupNodeEvents(on, config) {
      // Register TypeScript preprocessor
      on('file:preprocessor', require('@cypress/webpack-preprocessor')({
        webpackOptions: {
          resolve: {
            extensions: ['.ts', '.js']
          },
          module: {
            rules: [
              {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                  loader: 'ts-loader'
                }
              }
            ]
          }
        }
      }));

      // Configure code coverage reporting
      require('@cypress/code-coverage/task')(on, config);

      // Performance monitoring hooks
      on('before:test', (test) => {
        // Reset performance metrics before each test
        Cypress.env('testStartTime', Date.now());
      });

      on('after:test', (test) => {
        // Verify response times are under 2 seconds
        const testDuration = Date.now() - Cypress.env('testStartTime');
        if (testDuration > config.env.performance.maxResponseTime) {
          console.warn(`Test "${test.title}" exceeded maximum response time: ${testDuration}ms`);
          if (config.env.performance.failOnSlowResponses) {
            throw new Error(`Performance threshold exceeded: ${testDuration}ms`);
          }
        }
      });

      return config;
    },
    env: {
      apiUrl: 'http://localhost:54321',
      coverage: true,
      codeCoverage: {
        url: 'http://localhost:54321/__coverage__',
        threshold: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80
        }
      },
      performance: {
        maxResponseTime: 2000, // 2 seconds maximum response time
        recordMetrics: true,
        failOnSlowResponses: true
      }
    }
  },

  // Component Testing Configuration
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        optimizeDeps: {
          include: ['react', 'react-dom']
        }
      }
    },
    specPattern: 'src/tests/component/**/*.spec.ts',
    supportFile: 'cypress/support/component.ts'
  },

  // Global Configuration
  watchForFileChanges: false,
  chromeWebSecurity: false,
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
  video: true,
  screenshotOnRunFailure: true,
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'reporter-config.json'
  },
  retries: {
    runMode: 2,
    openMode: 0
  }
});