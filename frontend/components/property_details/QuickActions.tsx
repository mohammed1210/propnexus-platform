'use client';

import { useEffect, useState } from 'react';
import { FiHeart, FiShare2, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/api';

type QuickActionsProps = {
  propertyId: string;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  aiScore?: number;
};

export default function QuickActions({
  propertyId,
  price,
  yieldPercent,
  roiPercent,
  aiScore,
}: QuickActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

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
      {/* Desktop floating sidebar */}
      <div className="hidden lg:block fixed right-6 top-40 w-64 space-y-4 z-10 no-print">
        {/* Actions card */}
        <div className="panel">
          <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={saved ? 'Deal saved' : saving ? 'Saving deal' : 'Save this deal'}
              aria-pressed={saved}
            >
              {saved ? (
                <>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-red-300"
                    fill="currentColor"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <FiHeart className="w-4 h-4" aria-hidden="true" />
                  <span>{saving ? 'Saving...' : 'Save Deal'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              aria-label="Share this property"
            >
              <FiShare2 className="w-4 h-4" aria-hidden="true" />
              <span>Share</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              aria-label="Export property details as PDF"
            >
              <FiDownload className="w-4 h-4" aria-hidden="true" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleCopyJSON}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              aria-label={copied ? 'Property data copied' : 'Copy property data as JSON'}
            >
              {copied ? (
                <>
                  <FiCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <FiCopy className="w-4 h-4" aria-hidden="true" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile compact actions row */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 z-20 no-print">
        <div className="flex gap-2 max-w-7xl mx-auto" role="group" aria-label="Quick actions">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={saved ? 'Deal saved' : 'Save this deal'}
            aria-pressed={saved}
          >
            {saved ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="w-4 h-4 text-red-300"
                fill="currentColor"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <FiHeart className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="text-sm">{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            aria-label="Share this property"
          >
            <FiShare2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            aria-label="Export as PDF"
          >
            <FiDownload className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
