import { beforeAll, afterAll, afterEach } from 'vitest'; // v0.34.0
import { cleanup } from '@testing-library/react'; // v14.0.0
import { setupServer } from 'msw/node'; // v1.3.0
import { handlers } from './mocks/handlers';

// Create MSW server instance with mock API handlers
export const server = setupServer(...handlers);

// Global setup before all tests
beforeAll(() => {
  // Configure MSW error handling for unhandled requests
  server.listen({
    onUnhandledRequest: (req) => {
      console.warn(
        `Found an unhandled ${req.method} request to ${req.url}.\n` +
        'Consider adding a request handler for this endpoint.'
      );
    },
  });
});

// Cleanup after each test
afterEach(() => {
  // Reset DOM modifications
  cleanup();
  
  // Reset MSW request handlers to default state
  server.resetHandlers();
  
  // Clear any mocked timer intervals
  vi.clearAllTimers();
  
  // Reset any modified localStorage state
  localStorage.clear();
  
  // Reset any modified sessionStorage state
  sessionStorage.clear();
  
  // Clear any mock function calls
  vi.clearAllMocks();
});

// Global teardown after all tests
afterAll(() => {
  // Stop MSW server and cleanup
  server.close();
  
  // Ensure all timers are cleared
  vi.clearAllTimers();
  
  // Reset any modified environment variables
  process.env = { ...process.env };
  
  // Clear any remaining mocks
  vi.resetModules();
});

// Configure global test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserver,
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserver,
});

// Mock window.fetch
Object.defineProperty(window, 'fetch', {
  writable: true,
  value: vi.fn(),
});

// Configure console to fail tests on console.error
const originalError = console.error;
console.error = (...args) => {
  originalError(...args);
  throw new Error('Console error encountered during test');
};