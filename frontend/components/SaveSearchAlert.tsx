'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiChevronDown, FiPauseCircle, FiPlayCircle, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';

type AlertRow = {
  id?: string;
  label?: string | null;
  search_query?: string | null;
  filters?: Record<string, unknown> | null;
  min_discovery_score?: number | null;
  include_tiers?: string[] | null;
  frequency?: string | null;
  active?: boolean | null;
};

type SaveSearchAlertProps = {
  query: string;
  filters: Record<string, unknown>;
  sort: string;
};

const TIER_OPTIONS = [
  { value: 'prime', label: 'Prime' },
  { value: 'strong', label: 'Strong' },
  { value: 'watchlist', label: 'Watchlist' },
] as const;

const SORT_LABELS: Record<string, string> = {
  top_deals: 'Top Deals',
  recommended: 'Recommended',
  created_at_desc: 'Most recent',
  price_asc: 'Price low to high',
  price_desc: 'Price high to low',
  yield_desc: 'Highest yield',
  roi_desc: 'Highest ROI',
};

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function money(value: unknown) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `£${Math.round(num).toLocaleString('en-GB')}`;
}

function compactCriteria(query: string, filters: Record<string, unknown>, sort: string) {
  const chips: string[] = [];
  const q = query.trim();
  if (q) chips.push(`Search: ${q}`);
  const min = money(filters.min);
  const max = money(filters.max);
  if (min && max) chips.push(`${min}-${max}`);
  else if (min) chips.push(`From ${min}`);
  else if (max) chips.push(`Up to ${max}`);
  if (filters.beds) chips.push(`${filters.beds}+ beds`);
  if (filters.baths) chips.push(`${filters.baths}+ baths`);
  if (typeof filters.investment_type === 'string' && filters.investment_type) chips.push(titleCase(filters.investment_type));
  if (typeof filters.property_type === 'string' && filters.property_type) chips.push(titleCase(filters.property_type));
  chips.push(`Sort: ${SORT_LABELS[sort] || titleCase(sort)}`);
  return chips;
}

function defaultLabel(query: string, filters: Record<string, unknown>) {
  const q = query.trim();
  if (q) return `Deals for ${q}`;
  if (typeof filters.investment_type === 'string' && filters.investment_type) {
    return `${titleCase(filters.investment_type)} deal alert`;
  }
  if (typeof filters.property_type === 'string' && filters.property_type) {
    return `${titleCase(filters.property_type)} deal alert`;
  }
  return 'Saved deal alert';
}

function tierLabel(tiers: string[] | null | undefined) {
  const clean = Array.isArray(tiers) && tiers.length ? tiers : ['prime', 'strong'];
  return clean.map(titleCase).join(' + ');
}

async function readError(res: Response) {
  const body = await res.json().catch(() => null);
  if (res.status === 401) return body?.message || 'Please sign in to create deal alerts.';
  return body?.message || body?.detail || `Unable to save alert (${res.status})`;
}

export default function SaveSearchAlert({ query, filters, sort }: SaveSearchAlertProps) {
  const criteria = useMemo(() => compactCriteria(query, filters, sort), [filters, query, sort]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [authRequired, setAuthRequired] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [label, setLabel] = useState(() => defaultLabel(query, filters));
  const [frequency, setFrequency] = useState('daily');
  const [minScore, setMinScore] = useState(60);
  const [tiers, setTiers] = useState<string[]>(['prime', 'strong']);

  useEffect(() => {
    setLabel(defaultLabel(query, filters));
  }, [filters, query]);

  useEffect(() => {
    setMinScore(tiers.includes('watchlist') ? 45 : 60);
  }, [tiers]);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    setListError(null);
    try {
      const res = await fetch('/api/investor-alerts', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthRequired(true);
        setAlerts([]);
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const json = await res.json().catch(() => null);
      setAuthRequired(false);
      setAlerts(Array.isArray(json?.items) ? json.items : []);
    } catch (err: any) {
      setListError(err?.message || 'Could not load deal alerts.');
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) void loadAlerts();
  }, [expanded, loadAlerts]);

  function toggleTier(value: string) {
    setTiers((current) => {
      if (current.includes(value)) {
        const next = current.filter((tier) => tier !== value);
        return next.length ? next : current;
      }
      return [...current, value];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const cleanLabel = label.trim() || defaultLabel(query, filters);
      const res = await fetch('/api/investor-alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: cleanLabel,
          search_query: query,
          filters: { ...filters, sort },
          min_discovery_score: minScore,
          include_tiers: tiers,
          frequency,
          active: true,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const json = await res.json().catch(() => null);
      if (json?.alert) setAlerts((current) => [json.alert, ...current]);
      setAuthRequired(false);
      setExpanded(true);
      toast.success('Deal alert created');
    } catch (err: any) {
      toast.error(err?.message || 'Could not create alert');
    } finally {
      setSaving(false);
    }
  }

  async function updateAlert(alertId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/investor-alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await readError(res));
    setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, ...patch } : alert)));
  }

  async function deleteAlert(alertId: string) {
    const res = await fetch(`/api/investor-alerts/${encodeURIComponent(alertId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await readError(res));
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  }

  const activeAlerts = alerts.filter((alert) => alert.active !== false).length;

  const alertSummary = `${tierLabel(tiers)} · ${minScore}+ score · ${frequency}`;

  return (
    <div className="rounded-xl border border-brand-200 bg-white/90 px-3 py-3 text-xs shadow-sm dark:border-brand-900/50 dark:bg-slate-950/50">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
              <FiBell className="h-4 w-4" />
            </span>
            <div>
              <div className="font-black text-slate-900 dark:text-white">Deal alert workflow</div>
              <div className="text-slate-500 dark:text-slate-400">Monitor this search for new investor leads that meet your evidence threshold.</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {criteria.slice(0, 7).map((chip) => (
              <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-expanded={expanded}
          >
            Configure
            <FiChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 font-bold text-white disabled:opacity-60">
            {saving ? 'Creating...' : 'Create alert'}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span>{alertSummary}</span>
        <span aria-hidden="true">|</span>
        <span>{activeAlerts ? `${activeAlerts} active alert${activeAlerts === 1 ? '' : 's'}` : 'No active alerts loaded'}</span>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block font-bold text-slate-700 dark:text-slate-200">Alert name</span>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="input-field w-full"
                maxLength={80}
              />
            </label>

            <div>
              <div className="mb-1 font-bold text-slate-700 dark:text-slate-200">Lead quality</div>
              <div className="grid grid-cols-3 gap-2">
                {TIER_OPTIONS.map((option) => {
                  const selected = tiers.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleTier(option.value)}
                      className={`h-9 rounded-lg border px-2 font-bold transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700 dark:text-slate-200">Minimum discovery score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(event) => setMinScore(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                  className="input-field w-full"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700 dark:text-slate-200">Digest frequency</span>
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="input-field w-full">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            </div>

            {authRequired ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="font-bold">Sign in required</div>
                <div className="mt-1">Create alerts from a signed-in account so they can be attached to your saved workflow.</div>
                <Link href="/sign-in?redirect_url=/listings" className="mt-2 inline-flex font-black underline">
                  Sign in
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-black text-slate-900 dark:text-white">Existing alerts</div>
                <div className="text-slate-500 dark:text-slate-400">Pause or delete saved searches.</div>
              </div>
              <button type="button" onClick={loadAlerts} className="rounded-md border border-slate-300 px-2 py-1 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300" disabled={loadingAlerts}>
                {loadingAlerts ? 'Loading' : 'Refresh'}
              </button>
            </div>

            {listError ? <div className="mt-3 rounded-md bg-rose-50 px-2 py-2 font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{listError}</div> : null}

            <div className="mt-3 space-y-2">
              {loadingAlerts && alerts.length === 0 ? (
                <div className="text-slate-500 dark:text-slate-400">Loading alerts...</div>
              ) : alerts.length === 0 ? (
                <div className="text-slate-500 dark:text-slate-400">No saved alerts yet.</div>
              ) : (
                alerts.slice(0, 4).map((alert) => {
                  const alertId = alert.id || '';
                  const isActive = alert.active !== false;
                  return (
                    <div key={alertId || alert.label || 'alert'} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-800 dark:text-slate-100">{alert.label || 'Deal alert'}</div>
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {tierLabel(alert.include_tiers)} · {alert.min_discovery_score ?? 60}+ · {alert.frequency || 'daily'}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            title={isActive ? 'Pause alert' : 'Resume alert'}
                            onClick={() => {
                              if (!alertId) return;
                              updateAlert(alertId, { active: !isActive })
                                .then(() => toast.success(isActive ? 'Alert paused' : 'Alert resumed'))
                                .catch((err) => toast.error(err?.message || 'Could not update alert'));
                            }}
                          >
                            {isActive ? <FiPauseCircle className="h-4 w-4" /> : <FiPlayCircle className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
                            title="Delete alert"
                            onClick={() => {
                              if (!alertId) return;
                              deleteAlert(alertId)
                                .then(() => toast.success('Alert deleted'))
                                .catch((err) => toast.error(err?.message || 'Could not delete alert'));
                            }}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 font-bold ${isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {isActive ? 'Active' : 'Paused'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
