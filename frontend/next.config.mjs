// frontend/next.config.mjs
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
  reactStrictMode: true,

  // Silence multiple-lockfiles warning in monorepos
  outputFileTracingRoot: resolve(__dirname, ".."),

  // IMPORTANT: Fix "Invalid Server Actions request" in Codespaces / github.dev
  // Next compares the forwarded host (e.g. *.app.github.dev) with the Origin.
  // Allow the forwarded host origins explicitly.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        // GitHub Codespaces forwarded ports:
        "*.app.github.dev",
        // GitHub.dev editor hosts (rare but harmless to include):
        "*.github.dev",
      ],
    },
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // All paths relative to the FRONTEND folder
      "@components": resolve(__dirname, "components"),
      "@details": resolve(__dirname, "components/property_details"),
      "@MapView": resolve(__dirname, "components/MapView"),
      "@lib": resolve(__dirname, "lib"),
      "@": resolve(__dirname, "."),
    };
    return config;
  },
};

// Only enable Sentry in production when DSN is configured
const useSentry =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN;

let exportedConfig = nextConfig;

if (useSentry) {
  try {
    const { withSentryConfig } = await import("@sentry/nextjs");
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    });
  } catch (err) {
    console.warn("[next.config] Sentry wrapper skipped:", err?.message ?? err);
  }
}

export default exportedConfig;
