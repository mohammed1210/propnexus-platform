import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";
import { FiAlertTriangle, FiBarChart2, FiPieChart, FiSearch, FiShield, FiTrendingUp, FiUsers, FiZap } from "react-icons/fi";
import AuthStatusPanel from "@/components/admin/AuthStatusPanel";
import RunImportPanel from "@/components/admin/RunImportPanel";

export const metadata = {
  title: "Admin • PropNexus",
  robots: { index: false, follow: false },
};

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
  // Preferred: explicit tier metadata (legacy shape)
  const tierFromMetadata =
    subscription?.prices?.products?.metadata?.tier ??
    subscription?.prices?.product?.metadata?.tier ??
    subscription?.product?.metadata?.tier;

  const normalizedMetadataTier = safeString(tierFromMetadata);
  if (normalizedMetadataTier) return normalizedMetadataTier;

  // Schema-aligned: infer from Stripe price ids (most reliable)
  const priceId: string =
    safeString(subscription?.price_id) ||
    safeString(subscription?.prices?.stripe_price_id) ||
    safeString(subscription?.prices?.id);

  const proPrice = safeString(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO);
  const investorPrice = safeString(process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR);

  if (investorPrice && priceId && priceId === investorPrice) return "investor";
  if (proPrice && priceId && priceId === proPrice) return "pro";

  // Last resort: infer from price nickname
  const nickname = safeString(subscription?.prices?.nickname).toLowerCase();
  if (nickname.includes("investor")) return "investor";
  if (nickname.includes("pro")) return "pro";

  return "";
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

function getBillingInterval(subscription: any): string {
  const interval =
    subscription?.prices?.billing_interval ??
    subscription?.prices?.recurring?.interval ??
    subscription?.billing_interval ??
    subscription?.interval;
  return safeString(interval).toLowerCase();
}

function getMRRContributionGBP(subscription: any): number {
  if (!isGBP(subscription)) return 0;

  const unitAmount = getUnitAmount(subscription);
  const amountGBP = safeNumber(unitAmount) / 100;
  const interval = getBillingInterval(subscription);

  // Convert annual pricing to monthly recurring revenue.
  if (interval === 'year' || interval === 'annual') {
    return amountGBP / 12;
  }

  return amountGBP;
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
    // Schema expects: subscriptions.price_id -> prices.stripe_price_id
    let activeSubsList: any[] = [];

    const { data: subscriptions, error: mrrError } = await supabase
      .from("subscriptions")
      .select("*, prices(*)")
      .in("status", ["trialing", "active"]);

    if (!mrrError) {
      activeSubsList = Array.isArray(subscriptions) ? subscriptions : [];
    } else {
      const msg = mrrError.message || "";
      const looksLikeRelationshipError =
        msg.toLowerCase().includes("schema cache") ||
        msg.toLowerCase().includes("could not find a relationship") ||
        msg.toLowerCase().includes("relationship between");

      warnings.push(
        looksLikeRelationshipError
          ? "MRR join is not available (missing FK/relationship in Supabase schema cache). Falling back to manual lookup."
          : `MRR query failed: ${mrrError.message}`
      );

      // Fallback: fetch subscriptions only, then map prices by stripe_price_id.
      const { data: subsOnly, error: subsOnlyError } = await supabase
        .from("subscriptions")
        .select("*")
        .in("status", ["trialing", "active"]);

      if (subsOnlyError) {
        warnings.push(`MRR fallback subscriptions query failed: ${subsOnlyError.message}`);
        activeSubsList = [];
      } else {
        const subsList = Array.isArray(subsOnly) ? subsOnly : [];
        const priceIds = Array.from(
          new Set(
            subsList
              .map((s: any) => safeString(s?.price_id))
              .filter(Boolean)
          )
        );

        let pricesMap = new Map<string, any>();
        if (priceIds.length) {
          const { data: prices, error: pricesError } = await supabase
            .from("prices")
            .select("*")
            .in("stripe_price_id", priceIds);

          if (pricesError) {
            warnings.push(`MRR fallback prices query failed: ${pricesError.message}`);
          } else {
            (Array.isArray(prices) ? prices : []).forEach((p: any) => {
              const key = safeString(p?.stripe_price_id);
              if (key) pricesMap.set(key, p);
            });
          }
        }

        activeSubsList = subsList.map((s: any) => {
          const pid = safeString(s?.price_id);
          const price = pid ? pricesMap.get(pid) : null;
          return price ? { ...s, prices: price } : s;
        });
      }
    }

    const investorActive = activeSubsList.filter((s) => isTier(s, "investor"));
    const proActive = activeSubsList.filter((s) => isTier(s, "pro"));

    const investorMRRGBP = investorActive.reduce(
      (total, s) => total + getMRRContributionGBP(s),
      0
    );

    const proMRRGBP = proActive.reduce((total, s) => total + getMRRContributionGBP(s), 0);

    const totalMRRGBP = activeSubsList.reduce(
      (total, s) => total + getMRRContributionGBP(s),
      0
    );

    // If tier inference is missing, still show total MRR, but explain why breakdown is incomplete.
    const unknownTierCount = activeSubsList.filter((s) => !getTier(s)).length;
    if (activeSubsList.length > 0 && unknownTierCount === activeSubsList.length) {
      warnings.push(
        'Could not infer tier for any active subscriptions. Set NEXT_PUBLIC_STRIPE_PRICE_PRO / NEXT_PUBLIC_STRIPE_PRICE_INVESTOR or populate prices.nickname.'
      );
    } else if (unknownTierCount > 0) {
      warnings.push(
        `${unknownTierCount} active subscription(s) have unknown tier. Included in total MRR, but excluded from tier breakdown.`
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
  tone = "brand",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "brand" | "emerald" | "blue" | "amber" | "violet" | "slate";
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-200 dark:ring-brand-900/50",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50",
    blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-200 dark:ring-blue-900/50",
    amber: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/50",
    violet: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/35 dark:text-violet-200 dark:ring-violet-900/50",
    slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  }[tone];

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        {Icon ? (
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      {sub ? (
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>
      ) : null}
    </div>
  );
}

function WarningBox({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/90 p-5 text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <FiAlertTriangle className="h-4 w-4" aria-hidden />
        <p className="font-semibold">Heads up</p>
      </div>
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
      <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <FiShield className="h-3.5 w-3.5" aria-hidden />
            Runtime configuration
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Admin stats require Supabase server environment variables.
          </p>
          </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-200">
            Admin dashboard is not available right now.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Please ensure Supabase environment variables are configured correctly (server-side).
          </p>

          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
            Expected server-side Supabase configuration is missing or invalid. Check deployment secrets in the hosting dashboard.
          </p>
        </div>
        </div>
      </main>
    );
  }

  const stats = await getAdminStats();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                <FiShield className="h-3.5 w-3.5" aria-hidden />
                Admin workspace
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Admin Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Live operating view for subscriptions, revenue health, imports, and search telemetry.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Active subs</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{stats.subscribers}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">MRR</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatGBP(stats.mrrGBP)}</p>
              </div>
            </div>
          </div>
        </div>

      <AuthStatusPanel />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Subscribers" value={stats.subscribers} sub="Trialing + active" icon={FiUsers} tone="brand" />
        <StatCard label="Total MRR (GBP)" value={formatGBP(stats.mrrGBP)} sub="Investor + Pro" icon={FiTrendingUp} tone="emerald" />
        <StatCard label="Investor Tier" value={stats.investorTier} sub={`MRR: ${formatGBP(stats.investorMRRGBP)}`} icon={FiZap} tone="amber" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Pro Tier" value={stats.proTier} sub={`MRR: ${formatGBP(stats.proMRRGBP)}`} icon={FiBarChart2} tone="blue" />
        <StatCard
          label="MRR Split"
          value={`${formatGBP(stats.investorMRRGBP)} / ${formatGBP(stats.proMRRGBP)}`}
          sub="Investor / Pro"
          icon={FiPieChart}
          tone="violet"
        />
        <StatCard
          label="Tier Coverage"
          value={`${stats.investorTier + stats.proTier}/${stats.subscribers}`}
          sub="Tiered subs / Total"
          icon={FiShield}
          tone="slate"
        />
      </div>

      <WarningBox warnings={stats.warnings} />

      <div className="mt-8">
        <RunImportPanel />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-200 dark:ring-blue-900/50">
              <FiSearch className="h-4 w-4" aria-hidden />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Search Analytics</h2>
          </div>
          <Link
            href="/admin/search-metrics"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Open Dashboard
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          View 7-day search health KPIs and top zero-result queries.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Notes</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            If MRR shows £0, confirm{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">prices</code> →
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">products</code>{" "}
            relationship exists and that product metadata contains{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">tier</code> ={" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">investor</code> or{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">pro</code>.
          </li>
          <li>
            This page is forced dynamic to avoid build-time failures in Vercel and to keep stats fresh.
          </li>
        </ul>
      </div>
      </div>
    </main>
  );
}
