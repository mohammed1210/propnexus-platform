'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import StripePortalButton from '@/components/StripePortalButton';
import PlanBadge from '@/components/PlanBadge';
import { useUserPlan } from '@/lib/useUserPlan';
import { toast } from 'sonner';
import { isAuthEnabled } from '@/lib/auth';

/** Force dynamic so we don't cache auth state */
export const dynamic = 'force-dynamic';

function AccountPageContent() {
  const searchParams = useSearchParams();
  const { refetch: refetchPlan } = useUserPlan();

  const { isLoaded: clerkLoaded, isSignedIn, user } = useUser();
  const isLoaded = !isAuthEnabled || clerkLoaded;
  const effectiveUser = isAuthEnabled && isSignedIn ? user : null;

  useEffect(() => {
    (async () => {
      if (searchParams) {
        const success = searchParams.get('success');
        const sessionId = searchParams.get('session_id');

        if (success === 'true' && sessionId) {
          toast.success('Subscription updated successfully!');

          setTimeout(async () => {
            try {
              await refetchPlan();
              toast.success('Your plan has been updated!');
            } catch (err) {
              console.error('Failed to refresh plan:', err);
            }
          }, 2000);
        }
      }
    })();
  }, [searchParams, refetchPlan]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Manage Subscription</h1>
        <PlanBadge size="md" />
      </div>
      <p className="text-zinc-600 dark:text-zinc-300 mb-6">
        Update your plan, billing details, or cancel anytime.
      </p>

      {!isLoaded ? (
        <p>Loading…</p>
      ) : effectiveUser ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
            <div>
              <div className="text-sm text-zinc-500">Signed in as</div>
              <div className="font-semibold">{effectiveUser.primaryEmailAddress?.emailAddress}</div>
              <div className="mt-2">
                <PlanBadge />
              </div>
            </div>
          </div>

          <StripePortalButton />

          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Looking to upgrade? See{' '}
            <Link href="/pricing" className="underline hover:text-blue-600">
              pricing
            </Link>
            .
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p>You&apos;re not signed in.</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-md bg-zinc-900 text-white px-4 py-2 font-medium hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            After signing in you&apos;ll return here to manage your subscription.
          </div>
        </div>
      )}
    </main>
  );
}

export default function AccountPage() {
  if (!isAuthEnabled) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Manage Subscription</h1>
          <PlanBadge size="md" />
        </div>
        <p className="text-zinc-600 dark:text-zinc-300 mb-6">
          Subscription management is unavailable because authentication is disabled.
        </p>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          If this is unexpected, set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> (and ensure auth
          is not disabled) then redeploy.
        </div>
        <div className="mt-4">
          <Link href="/pricing" className="underline hover:text-blue-600">
            View pricing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Manage Subscription</h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Update your plan, billing details, or cancel anytime.
          </p>
          <p>Loading…</p>
        </main>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
