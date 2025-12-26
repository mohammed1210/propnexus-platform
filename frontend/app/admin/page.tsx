import { supabaseServer } from "@/lib/supabaseServer";

export const metadata = { title: "Admin • PropNexus" };

/**
 * Admin pages should NOT be statically generated during build.
 * This prevents build-time fetch errors and ensures fresh stats at runtime.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminStats = {
  subscribers: number;
  mrrGBP: number;
  investorTier: number;
  warnings?: string[];
};

function safeNumber(n: unknown): number {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num : 0;
}

function safeString(s: unknown): string {
  return typeof s === "string" ? s : "";
}

function isInvestorTier(subscription: any): boolean {
  // Supports multiple shapes:
  // - subscription.prices.products.metadata.tier
  // - subscription.prices.product.metadata.tier (just in case)
  const tier =
    subscription?.prices?.products?.metadata?.tier ??
    subscription?.prices?.product?.metadata?.tier ??
    subscription?.product?.metadata?.tier;

  return safeString(tier) === "investor";
}

function isGBP(subscription: any): boolean {
  const currency = subscription?.prices?.currency ?? subscription?.currency;
  return safeString(currency).toLowerCase() === "gbp";
}

function getUnitAmount(subscription: any): number {
  // unit_amount often lives on prices.unit_amount (Stripe-style)
  // fallback just in case to subscription.unit_amount
  return safeNumber(subscription?.prices?.unit_amount ?? subscription?.unit_amount);
}

async function getAdminStats(): Promise<AdminStats> {
  const warnings: string[] = [];

  try {
    const supabase = supabaseServer();

    if (!supabase) {
      warnings.push("Supabase server client not available (missing env vars).");
      return { subscribers: 0, mrrGBP: 0, investorTier: 0, warnings };
    }

    /**
     * 1) Active subscription count
     * We use head:true for count-only queries.
     */
    const { count: activeSubscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["trialing", "active"]);

    if (subsError) {
      warnings.push(`Active subscription count query failed: ${subsError.message}`);
    }

    /**
     * 2) Pull active subs for MRR + tier calculations
     * This join shape can vary depending on schema:
     * - prices(*, products(*))
     * If the relation is missing, we still return safe defaults.
     */
    const { data: subscriptions, error: mrrError } = await supabase
      .from("subscriptions")
      .select("*, prices(*, products(*))")
      .in("status", ["trialing", "active"]);

    if (mrrError) {
      warnings.push(`MRR query failed: ${mrrError.message}`);
    }

    const activeSubsList = Array.isArray(subscriptions) ? subscriptions : [];

    // MRR in GBP for investor tier only
    const mrrGBP =
      activeSubsList
        .filter((s) => isInvestorTier(s) && isGBP(s))
        .reduce((total, s) => total + getUnitAmount(s), 0) / 100;

    // Total investor tier subscribers (any currency)
    const investorTier = activeSubsList.filter((s) => isInvestorTier(s)).length;

    return {
      subscribers: safeNumber(activeSubscriptions ?? activeSubsList.length),
      mrrGBP: safeNumber(mrrGBP),
      investorTier: safeNumber(investorTier),
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (error: any) {
    console.error("Error fetching admin stats:", {
      message: error?.message || String(error),
      details: error?.stack || "",
    });

    return {
      subscribers: 0,
      mrrGBP: 0,
      investorTier: 0,
      warnings: ["Unexpected error while computing admin stats."],
    };
  }
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">
        {value}
        {suffix ? <span className="ml-1 text-lg text-gray-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

function WarningBox({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <p className="font-semibold">Heads up</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {warnings.map((w, idx) => (
          <li key={idx}>{w}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-800">
        This page will still load, but you may need to verify Supabase environment variables and table
        relationships in production.
      </p>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = supabaseServer();

  // If Supabase client is missing, show a friendly message — no crash.
  if (!supabase) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Admin stats require Supabase server environment variables.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-700">
            Admin dashboard is not available right now.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please ensure Supabase environment variables are configured correctly (server-side).
          </p>

          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
            <p className="font-semibold mb-1">Expected variables (examples):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>SUPABASE_URL</li>
              <li>SUPABASE_SERVICE_ROLE_KEY</li>
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
        </div>
      </main>
    );
  }

  const stats = await getAdminStats();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Live stats based on active subscriptions (trialing + active).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Subscribers" value={stats.subscribers} />
        <StatCard label="MRR" value={stats.mrrGBP.toFixed(2)} suffix="GBP" />
        <StatCard label="Investor Tier" value={stats.investorTier} />
      </div>

      <WarningBox warnings={stats.warnings} />

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-600 space-y-2">
          <li>
            If MRR shows 0, confirm <code className="px-1 rounded bg-gray-100">prices</code> →
            <code className="px-1 rounded bg-gray-100">products</code> relationship exists and that
            product metadata contains <code className="px-1 rounded bg-gray-100">tier=investor</code>.
          </li>
          <li>
            This page is forced dynamic to avoid build-time failures in Vercel and to keep stats fresh.
          </li>
        </ul>
      </div>
    </main>
  );
}
