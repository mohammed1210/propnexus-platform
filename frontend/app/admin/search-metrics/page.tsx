import Link from 'next/link';

export const metadata = {
  title: 'Search Metrics • PropNexus Admin',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ZeroQuery = { query: string; count: number };
type MetricsResponse = {
  searches_total: number;
  zero_results_rate: number;
  ctr: number;
  top_zero_result_queries: ZeroQuery[];
};

function asPercent(v: number): string {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

async function loadMetrics(): Promise<MetricsResponse | null> {
  const enabled = process.env.FEATURE_ADMIN_SEARCH_METRICS === '1';
  if (!enabled) return null;

  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:8000';

  const adminToken = process.env.ADMIN_TOKEN || process.env.IMPORT_ADMIN_TOKEN || '';
  if (!adminToken) return null;

  const res = await fetch(`${base.replace(/\/$/, '')}/analytics/metrics`, {
    headers: { 'x-admin-token': adminToken },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return (await res.json()) as MetricsResponse;
}

export default async function AdminSearchMetricsPage() {
  const metrics = await loadMetrics();

  if (!metrics) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Search Metrics
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This page is behind the `FEATURE_ADMIN_SEARCH_METRICS` flag and requires an admin token.
        </p>
        <div className="mt-6">
          <Link href="/admin" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            Back to Admin Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Search Metrics (7d)
        </h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
          Back to Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Searches Total</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {metrics.searches_total}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Zero Results Rate</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {asPercent(metrics.zero_results_rate)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">CTR</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {asPercent(metrics.ctr)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Top Zero Result Queries
        </h2>
        {metrics.top_zero_result_queries.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No zero-result searches in the last 7 days.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {metrics.top_zero_result_queries.map((item) => (
              <li key={item.query} className="flex items-center justify-between">
                <span>{item.query}</span>
                <span className="font-medium">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
