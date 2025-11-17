/**
 * Clerk Authentication Configuration
 * 
 * This file provides helper functions and runtime checks for Clerk authentication.
 * Note: This project currently uses Supabase Auth, not Clerk. This file is included
 * for future migration support and to provide helpful error messages if Clerk
 * environment variables are detected.
 */

/**
 * Check if Clerk environment variables are configured
 */
export function isClerkConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
}

/**
 * Get Clerk configuration with runtime validation
 * @returns Clerk configuration object or null if not configured
 */
export function getClerkConfig() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Only validate if at least one Clerk variable is set
  if (publishableKey || secretKey) {
    if (!publishableKey) {
      console.warn(
        '[Clerk Config] CLERK_SECRET_KEY is set but NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. ' +
        'Clerk authentication will not work without the publishable key.'
      );
    }
    
    if (!secretKey && typeof window === 'undefined') {
      console.warn(
        '[Clerk Config] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set but CLERK_SECRET_KEY is missing. ' +
        'Server-side Clerk operations will not work without the secret key.'
      );
    }
  }
  
  if (!publishableKey && !secretKey) {
    // No Clerk variables set - this is normal if using Supabase Auth
    return null;
  }
  
  return {
    publishableKey,
    secretKey,
    afterSignInUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/dashboard',
    afterSignUpUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/dashboard',
    appUrl,
  };
}

/**
 * Validate all required environment variables at runtime
 * Call this in _app.tsx or layout.tsx on mount to catch configuration issues early
 */
export function validateEnvironmentVariables() {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check for app URL in production
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push(
      'NEXT_PUBLIC_APP_URL is not set. Authentication redirects may not work correctly. ' +
      'Set this to your deployed URL (e.g., https://propnexus-platform.vercel.app)'
    );
  }
  
  // Check Clerk configuration if variables are present
  const clerkConfig = getClerkConfig();
  if (clerkConfig) {
    if (!clerkConfig.publishableKey) {
      errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required when using Clerk');
    }
    if (!clerkConfig.secretKey && typeof window === 'undefined') {
      errors.push('CLERK_SECRET_KEY is required for server-side Clerk operations');
    }
    
    // Log helpful setup instructions
    console.info(
      '[Clerk Config] Clerk authentication is configured. Make sure to set up redirect URLs in your Clerk Dashboard:\n' +
      `  - Sign-in redirect: ${clerkConfig.appUrl}${clerkConfig.afterSignInUrl}\n` +
      `  - Sign-up redirect: ${clerkConfig.appUrl}${clerkConfig.afterSignUpUrl}\n` +
      `  - Callback URL: ${clerkConfig.appUrl}/api/auth/callback`
    );
  }
  
  // Check Supabase configuration (current auth system)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !clerkConfig) {
    warnings.push(
      'NEXT_PUBLIC_SUPABASE_URL is not set and Clerk is not configured. ' +
      'Authentication will not work without one of these systems configured.'
    );
  }
  
  // Log all warnings and errors
  warnings.forEach(warning => console.warn(`[Env Config Warning] ${warning}`));
  errors.forEach(error => console.error(`[Env Config Error] ${error}`));
  
  return {
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
  };
}

/**
 * Runtime check helper to be called in browser console or during development
 */
if (typeof window !== 'undefined') {
  (window as any).__checkEnvConfig = validateEnvironmentVariables;
}
