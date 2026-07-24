import Link from 'next/link';

type SuccessPageProps = {
  searchParams?: Promise<{
    session_id?: string | string[];
  }>;
};

function getSessionId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export const dynamic = 'force-dynamic';

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = searchParams ? await searchParams : {};
  const sessionId = getSessionId(params.session_id);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">
          Stripe checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Checkout complete
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          Your subscription is being activated. This can take a few seconds while Stripe confirms the checkout and PropNexus updates your account.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          If your account still shows the previous plan, refresh the account page shortly. Entitlements are updated by the secure Stripe webhook, not by this return page.
        </p>

        {sessionId ? (
          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Checkout reference received.
          </p>
        ) : (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            No checkout reference was included, but you can still check your account status below.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/account" className="btn-primary justify-center">
            Go to account
          </Link>
          <Link href="/analyse" className="btn-secondary justify-center">
            Analyse a deal
          </Link>
          <Link href="/pricing" className="btn-secondary justify-center">
            View pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
