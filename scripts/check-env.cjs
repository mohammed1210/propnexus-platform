#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 *
 * This script checks for the presence of required environment variables
 * and provides clear instructions for missing configuration.
 *
 * Usage: node scripts/check-env.cjs
 *        npm run validate-config
 */

const path = require("path");
const fs = require("fs");

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvFile(filePath, label) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log(`✓ ${label} exists`, "green");
    return true;
  } else {
    log(`✗ ${label} not found`, "red");
    return false;
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};

  content.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });

  return env;
}

function checkVariable(env, key, required = true) {
  const value = env[key] || process.env[key];

  // Treat placeholders as missing (common patterns in .env.example files)
  const hasValue =
    value &&
    value !== "" &&
    !value.startsWith("your-") &&
    !value.endsWith("xxx") &&
    !value.includes("REPLACE_ME") &&
    !value.includes("YOUR_") &&
    !value.includes("<") &&
    !value.includes(">");

  if (hasValue) {
    log(`  ✓ ${key}`, "green");
    return true;
  } else if (required) {
    log(`  ✗ ${key} - REQUIRED`, "red");
    return false;
  } else {
    log(`  ! ${key} - Optional (not set)`, "yellow");
    return true;
  }
}

function isRealCiEnvironment() {
  // Some environments (including Codespaces/agents) may set CI=true.
  // We only want to fail hard in actual CI providers or production builds.
  return (
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.VERCEL === "1" ||
    process.env.RAILWAY_ENVIRONMENT_NAME != null ||
    process.env.GITLAB_CI === "true" ||
    process.env.CIRCLECI === "true" ||
    process.env.BUILDKITE === "true" ||
    process.env.TF_BUILD === "True" // Azure Pipelines
  );
}

function main() {
  log("\n" + "=".repeat(60), "cyan");
  log("PropNexus Environment Configuration Check", "bold");
  log("=".repeat(60) + "\n", "cyan");

  const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env.local");
  const backendEnvPath = path.join(__dirname, "..", "backend", ".env");

  let allGood = true;

  // Check Frontend Environment
  log("\n📦 Frontend Environment (.env.local)", "cyan");
  log("-".repeat(60), "cyan");

  const hasFrontendEnv = checkEnvFile(frontendEnvPath, "frontend/.env.local");

  if (hasFrontendEnv) {
    const frontendEnv = loadEnvFile(frontendEnvPath);

    log("\nRequired Variables:", "yellow");
    allGood = checkVariable(frontendEnv, "NEXT_PUBLIC_SUPABASE_URL") && allGood;
    allGood =
      checkVariable(frontendEnv, "NEXT_PUBLIC_SUPABASE_ANON_KEY") && allGood;
    allGood = checkVariable(frontendEnv, "NEXT_PUBLIC_API_BASE") && allGood;

    log("\nProduction Variables (required for deployment):", "yellow");
    checkVariable(frontendEnv, "NEXT_PUBLIC_APP_URL", false);
    checkVariable(frontendEnv, "SUPABASE_SERVICE_ROLE_KEY", false);

    log("\nStripe Variables:", "yellow");
    checkVariable(frontendEnv, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", false);
    checkVariable(frontendEnv, "STRIPE_SECRET_KEY", false);
    checkVariable(frontendEnv, "NEXT_PUBLIC_STRIPE_PRICE_PRO", false);
    checkVariable(frontendEnv, "NEXT_PUBLIC_STRIPE_PRICE_INVESTOR", false);

    log("\nClerk Variables (optional - for future migration):", "yellow");
    checkVariable(frontendEnv, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", false);
    checkVariable(frontendEnv, "CLERK_SECRET_KEY", false);
  } else {
    log("\n⚠️  Frontend .env.local not found. Copy from .env.example:", "yellow");
    log("   cp frontend/.env.example frontend/.env.local", "cyan");
    allGood = false;
  }

  // Check Backend Environment
  log("\n\n🔧 Backend Environment (.env)", "cyan");
  log("-".repeat(60), "cyan");

  const hasBackendEnv = checkEnvFile(backendEnvPath, "backend/.env");

  if (hasBackendEnv) {
    const backendEnv = loadEnvFile(backendEnvPath);

    log("\nRequired Variables:", "yellow");
    allGood = checkVariable(backendEnv, "SUPABASE_URL") && allGood;
    allGood = checkVariable(backendEnv, "SUPABASE_SERVICE_ROLE_KEY") && allGood;

    log("\nOptional Variables:", "yellow");
    checkVariable(backendEnv, "OPENAI_API_KEY", false);
    checkVariable(backendEnv, "STRIPE_SECRET_KEY", false);
    checkVariable(backendEnv, "RESEND_API_KEY", false);
  } else {
    log("\n⚠️  Backend .env not found. Copy from .env.example:", "yellow");
    log("   cp backend/.env.example backend/.env", "cyan");
    // Note: do not set allGood=false here because backend may not be needed for frontend dev.
    // But missing required vars are still shown above when backend is present.
  }

  // Summary
  log("\n" + "=".repeat(60), "cyan");
  if (allGood) {
    log("✅ Environment configuration looks good!", "green");
    log("\nℹ️  For production deployment, ensure these are set in Vercel/Railway:", "blue");
    log("   - NEXT_PUBLIC_APP_URL", "cyan");
    log("   - All Supabase keys", "cyan");
    log("   - Stripe keys (if using payments)", "cyan");
    log("   - Clerk keys (if migrating from Supabase)", "cyan");
  } else {
    log("❌ Some required environment variables are missing!", "red");
    log("\nℹ️  Follow the instructions above to fix configuration issues.", "yellow");
  }
  log("=".repeat(60) + "\n", "cyan");

  // ✅ Exit behaviour:
  // - In REAL CI or production: fail build if required vars are missing
  // - In local dev/Codespaces: do NOT fail, just warn (prevents blocking dev loops)
  const isProd = process.env.NODE_ENV === "production";
  const isRealCi = isRealCiEnvironment();

  if ((isRealCi || isProd) && !allGood) {
    process.exit(1);
  }
  process.exit(0);
}

main();
