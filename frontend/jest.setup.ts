// Ensure Web Streams API globals exist in the Jest (jsdom) environment.
try {
  // Only polyfill if TransformStream is missing
  if (!('TransformStream' in globalThis)) {
    // This patches globalThis with TransformStream, ReadableStream, etc.
    require('web-streams-polyfill/polyfill');
  }
} catch {
  // Best-effort; don't crash tests if require fails in odd envs
}

// Testing Library matchers
import '@testing-library/jest-dom';

// Mock Clerk for Jest/unit tests only (do NOT affect runtime)
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  ClerkProvider: ({ children }: any) => children,
}));
