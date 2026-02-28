// Ensure Web Streams API globals exist in the Jest (jsdom) environment.
try {
  // Only polyfill if TransformStream is missing
  if (!("TransformStream" in globalThis)) {
    // This patches globalThis with TransformStream, ReadableStream, etc.
    require("web-streams-polyfill/polyfill");
  }
} catch {
  // Best-effort; don't crash tests if require fails in odd envs
}

// Testing Library matchers
import "@testing-library/jest-dom";

import { jest } from "@jest/globals";

// --- Mock Next.js App Router (prevents: "expected app router to be mounted") ---
jest.mock("next/navigation", () => {
  const actual = jest.requireActual<Record<string, any>>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  };
});

// Mock Clerk for Jest/unit tests only (do NOT affect runtime)
jest.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
  ClerkProvider: ({ children }: any) => children,
}));
