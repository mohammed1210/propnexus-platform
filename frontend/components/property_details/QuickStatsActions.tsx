'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiHeart, FiShare2, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/api';
import { formatPercent, getRoiPercent, getYieldPercent, normalizeProperty } from '@/lib/normalizeProperty';

type QuickStatsActionsProps = {
  propertyId: string;
  property?: Record<string, any> | null;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  discountPercent?: number;
  aiScore?: number;
};

const formatValue = (value: number | undefined, format: 'currency' | 'percent' | 'score' = 'currency'): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return formatPercent(value);
    case 'score':
      return `${value.toFixed(1)}/10`;
    default:
      return value.toLocaleString('en-GB');
  }
};

export default function QuickStatsActions({
  propertyId,
  property,
  price,
  yieldPercent,
  roiPercent,
  discountPercent,
  aiScore,
}: QuickStatsActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const merged = useMemo(
    () => ({
      ...(property ?? {}),
      id: propertyId,
      price,
      yield_percent: yieldPercent,
      roi_percent: roiPercent,
    }),
    [property, propertyId, price, yieldPercent, roiPercent],
  );

  const normalized = useMemo(() => normalizeProperty(merged), [merged]);

  const displayPrice = typeof price === 'number' ? price : normalized.price ?? undefined;
  const displayYield = getYieldPercent(merged) ?? undefined;
  const displayRoi = getRoiPercent(merged) ?? undefined;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchWithRetry(`/api/saved-deals?property_id=${encodeURIComponent(propertyId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const json: any = await res.json().catch(() => null);
        const items = Array.isArray(json) ? json : json?.data;
        if (cancelled) return;
        if (Array.isArray(items) && items.length > 0) setSaved(true);
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetchWithRetry('/api/save-deal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error('Please sign in to save deals.');
          return;
        }
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `Save failed (${res.status})`);
      }

      setSaved(true);
      toast.success('Saved to Deals');
    } catch (err) {
      console.error(err);
      toast.error('Could not save this deal.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Property on PropNexus',
          url: window.location.href,
        });
        toast.success('Shared successfully!');
      } catch (err) {
        // User cancelled share - don't show error
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleExportPDF = () => {
    // TODO: Integrate with PDF export
    toast.info('PDF export coming soon!');
  };

  const handleCopyJSON = async () => {
    const data = {
      propertyId,
      price,
      yieldPercent,
      roiPercent,
      aiScore,
      url: window.location.href,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success('JSON data copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy JSON');
    }
  };

  return (
    <>
      {/* Desktop floating sidebar - combined stats and actions */}
      <div className="hidden lg:block fixed right-6 top-24 w-64 z-10 no-print">
        <div className="sticky top-24 space-y-4">
          {/* Quick Stats */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-5">
              Quick Stats
            </h3>

            <div className="space-y-5">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Price</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatValue(displayPrice, 'currency')}
                </div>
              </div>

              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Rental Yield</div>
                <div
                  className={`text-2xl font-bold ${
                    typeof displayYield === 'number' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatValue(displayYield, 'percent')}
                </div>
              </div>

              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  ROI
                </div>
                <div
                  className={`text-2xl font-bold ${
                    typeof displayRoi === 'number' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatValue(displayRoi, 'percent')}
                </div>
              </div>

              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Discount</div>
                <div
                  className={`text-2xl font-bold ${
                    typeof discountPercent === 'number' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {formatValue(discountPercent, 'percent')}
                </div>
              </div>

              {aiScore !== undefined && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">AI Score</div>
                  <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                    {formatValue(aiScore, 'score')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold hover:from-brand-600 hover:to-brand-700 transition-all disabled:opacity-70 shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                aria-label={saved ? 'Deal saved' : saving ? 'Saving deal' : 'Save this deal'}
                aria-pressed={saved}
              >
                {saved ? (
                  <>
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="w-5 h-5 text-red-300"
                      fill="currentColor"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span>Saved to Deals</span>
                  </>
                ) : (
                  <>
                    <FiHeart className="w-5 h-5" aria-hidden="true" />
                    <span>{saving ? 'Saving...' : 'Save Deal'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                aria-label="Share this property"
              >
                <FiShare2 className="w-5 h-5" aria-hidden="true" />
                <span>Share Property</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                aria-label="Export property details as PDF"
              >
                <FiDownload className="w-5 h-5" aria-hidden="true" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleCopyJSON}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                aria-label={copied ? 'Property data copied' : 'Copy property data as JSON'}
              >
                {copied ? (
                  <>
                    <FiCheck className="w-5 h-5" aria-hidden="true" />
                    <span>Data Copied!</span>
                  </>
                ) : (
                  <>
                    <FiCopy className="w-5 h-5" aria-hidden="true" />
                    <span>Copy Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile compact actions row */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 z-20 no-print shadow-2xl">
        <div className="flex gap-2 max-w-7xl mx-auto" role="group" aria-label="Quick actions">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold disabled:opacity-70 shadow-md hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label={saved ? 'Deal saved' : 'Save this deal'}
            aria-pressed={saved}
          >
            {saved ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="w-5 h-5 text-red-300"
                fill="currentColor"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <FiHeart className="w-5 h-5" aria-hidden="true" />
            )}
            <span className="text-sm">{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            aria-label="Share this property"
          >
            <FiShare2 className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            aria-label="Export as PDF"
          >
            <FiDownload className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
