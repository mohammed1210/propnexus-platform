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
  mrrGBP: number; // total MRR across tiers in GBP
  investorTier: number;
  proTier: number;
  investorMRRGBP: number;
  proMRRGBP: number;
  warnings?: string[];
};

function safeNumber(n: unknown): number {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num : 0;
}

function safeString(s: unknown): string {
  return typeof s === "string" ? s : "";
}

function formatGBP(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function getTier(subscription: any): string {
  // Supports multiple shapes:
  // - subscription.prices.products.metadata.tier
  // - subscription.prices.product.metadata.tier
  // - subscription.product.metadata.tier
  const tier =
    subscription?.prices?.products?.metadata?.tier ??
    subscription?.prices?.product?.metadata?.tier ??
    subscription?.product?.metadata?.tier;

  return safeString(tier);
}

function isTier(subscription: any, tierName: "investor" | "pro"): boolean {
  return getTier(subscription) === tierName;
}

function isGBP(subscription: any): boolean {
  const currency = subscription?.prices?.currency ?? subscription?.currency;
  return safeString(currency).toLowerCase() === "gbp";
}

function getUnitAmount(subscription: any): number {
  // unit_amount often lives on prices.unit_amount (Stripe-style)
  return safeNumber(subscription?.prices?.unit_amount ?? subscription?.unit_amount);
}

async function getAdminStats(): Promise<AdminStats> {
  const warnings: string[] = [];

  try {
    const supabase = supabaseServer();

    if (!supabase) {
      warnings.push("Supabase server client not available (missing env vars).");
      return {
        subscribers: 0,
        mrrGBP: 0,
        investorTier: 0,
        proTier: 0,
        investorMRRGBP: 0,
        proMRRGBP: 0,
        warnings,
      };
    }

    // 1) Count active subscriptions
    const { count: activeSubscriptions, error: subsError } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("status", ["trialing", "active"]);

    if (subsError) {
      warnings.push(`Active subscription count query failed: ${subsError.message}`);
    }

    // 2) Pull active subs for MRR + tier calculations
    const { data: subscriptions, error: mrrError } = await supabase
      .from("subscriptions")
      .select("*, prices(*, products(*))")
      .in("status", ["trialing", "active"]);

    if (mrrError) {
      warnings.push(`MRR query failed: ${mrrError.message}`);
    }

    const activeSubsList = Array.isArray(subscriptions) ? subscriptions : [];

    const investorActive = activeSubsList.filter((s) => isTier(s, "investor"));
    const proActive = activeSubsList.filter((s) => isTier(s, "pro"));

    const investorMRRGBP =
      investorActive
        .filter((s) => isGBP(s))
        .reduce((total, s) => total + getUnitAmount(s), 0) / 100;

    const proMRRGBP =
      proActive
        .filter((s) => isGBP(s))
        .reduce((total, s) => total + getUnitAmount(s), 0) / 100;

    const totalMRRGBP = safeNumber(investorMRRGBP) + safeNumber(proMRRGBP);

    // If tier metadata isn't present, warn (helps debugging)
    const anyTierPresent = activeSubsList.some((s) => !!getTier(s));
    if (activeSubsList.length > 0 && !anyTierPresent) {
      warnings.push(
        "No product tier metadata found. Confirm prices → products relationship and products.metadata.tier is set."
      );
    }

    return {
      subscribers: safeNumber(activeSubscriptions ?? activeSubsList.length),
      mrrGBP: safeNumber(totalMRRGBP),
      investorTier: investorActive.length,
      proTier: proActive.length,
      investorMRRGBP: safeNumber(investorMRRGBP),
      proMRRGBP: safeNumber(proMRRGBP),
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
      proTier: 0,
      investorMRRGBP: 0,
      proMRRGBP: 0,
      warnings: ["Unexpected error while computing admin stats."],
    };
  }
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
      ) : null}
    </div>
  );
}

function WarningBox({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">Heads up</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {warnings.map((w, idx) => (
          <li key={idx}>{w}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
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
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Admin stats require Supabase server environment variables.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-700 dark:text-zinc-200">
            Admin dashboard is not available right now.
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Please ensure Supabase environment variables are configured correctly (server-side).
          </p>

          <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-xs text-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
            <p className="mb-1 font-semibold">Expected variables (examples):</p>
            <ul className="list-disc space-y-1 pl-5">
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
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Live stats based on active subscriptions (trialing + active).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Subscribers" value={stats.subscribers} />
        <StatCard label="Total MRR (GBP)" value={formatGBP(stats.mrrGBP)} sub="Investor + Pro" />
        <StatCard label="Investor Tier" value={stats.investorTier} sub={`MRR: ${formatGBP(stats.investorMRRGBP)}`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Pro Tier" value={stats.proTier} sub={`MRR: ${formatGBP(stats.proMRRGBP)}`} />
        <StatCard
          label="MRR Split"
          value={`${formatGBP(stats.investorMRRGBP)} / ${formatGBP(stats.proMRRGBP)}`}
          sub="Investor / Pro"
        />
        <StatCard
          label="Tier Coverage"
          value={`${stats.investorTier + stats.proTier}/${stats.subscribers}`}
          sub="Tiered subs / Total"
        />
      </div>

      <WarningBox warnings={stats.warnings} />

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            If MRR shows £0, confirm{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">prices</code> →
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">products</code>{" "}
            relationship exists and that product metadata contains{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">tier</code> ={" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">investor</code> or{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">pro</code>.
          </li>
          <li>
            This page is forced dynamic to avoid build-time failures in Vercel and to keep stats fresh.
          </li>
        </ul>
      </div>
    </main>
  );
}
