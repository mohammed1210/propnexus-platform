'use client';

import { useEffect } from 'react';
import { validateEnvironmentVariables } from '@/lib/clerk';

/**
 * EnvValidator - Client component that validates environment variables on mount
 * This runs only in development to help catch configuration issues early
 */
export default function EnvValidator() {
  useEffect(() => {
    // Only run validation in development mode
    if (process.env.NODE_ENV === 'development') {
      const result = validateEnvironmentVariables();

      if (result.hasErrors || result.hasWarnings) {
        console.group('🔧 Environment Configuration Status');

        if (result.hasWarnings) {
          console.group('⚠️ Warnings:');
          result.warnings.forEach(warning => console.warn(warning));
          console.groupEnd();
        }

        if (result.hasErrors) {
          console.group('❌ Errors:');
          result.errors.forEach(error => console.error(error));
          console.groupEnd();
        }

        console.groupEnd();
      } else {
        console.info('✅ Environment configuration looks good!');
      }
    }
  }, []);

  return null;
}
