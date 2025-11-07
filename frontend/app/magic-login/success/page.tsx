'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MagicLoginSuccess() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push('/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <h1 className="text-3xl font-semibold mb-2">✅ You’re logged in!</h1>
      <p className="text-gray-600 dark:text-gray-300">Redirecting to your dashboard...</p>
    </main>
  );
}
