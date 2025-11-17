'use client';

import { useState } from 'react';
import { FiHeart, FiShare2, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'sonner';

type QuickStatsActionsProps = {
  propertyId: string;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  aiScore?: number;
};

const formatValue = (value: number | undefined, format: 'currency' | 'percent' | 'score' = 'currency'): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '—';
  }
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'score':
      return `${value.toFixed(1)}/10`;
    default:
      return value.toLocaleString('en-GB');
  }
};

export default function QuickStatsActions({
  propertyId,
  price,
  yieldPercent,
  roiPercent,
  aiScore,
}: QuickStatsActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Integrate with actual save API
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      toast.success('Deal saved successfully!');
      setTimeout(() => setSaved(false), 2000);
    }, 500);
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
              {price !== undefined && (
                <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Price</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatValue(price, 'currency')}
                  </div>
                </div>
              )}

              {yieldPercent !== undefined && (
                <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Rental Yield</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatValue(yieldPercent, 'percent')}
                  </div>
                </div>
              )}

              {roiPercent !== undefined && (
                <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">ROI</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatValue(roiPercent, 'percent')}
                  </div>
                </div>
              )}

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
                    <FiCheck className="w-5 h-5" aria-hidden="true" />
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
            <FiHeart className="w-5 h-5" aria-hidden="true" />
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
