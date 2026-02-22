// jest.setup.ts
import '@testing-library/jest-dom';

// Store original console methods BEFORE any mocking
const originalError = console.error.bind(console);
const originalWarn  = console.warn.bind(console);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  jest.spyOn(console, 'error').mockImplementation((msg: unknown, ...args: unknown[]) => {
    // Suppress known React/testing-library noise
    if (
      typeof msg === 'string' &&
      (msg.includes('act(') ||
       msg.includes('ReactDOM.render') ||
       msg.includes('Warning:'))
    ) return;

    // Use the ORIGINAL (pre-mock) console.error — NOT console.error()
    // which would recurse into the mock again
    originalError(msg, ...args);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});