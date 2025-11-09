'use client';

import { useState } from 'react';
import { FiHeart, FiShare2, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'sonner';

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
      {/* Desktop floating sidebar */}
      <div className="hidden lg:block fixed right-6 top-40 w-64 space-y-4 z-10 no-print">
        {/* Actions card */}
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-70 shadow-sm hover:shadow-md"
              aria-label="Save deal"
            >
              {saved ? (
                <>
                  <FiCheck className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <FiHeart className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Deal'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              aria-label="Share property"
            >
              <FiShare2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              aria-label="Export as PDF"
            >
              <FiDownload className="w-4 h-4" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleCopyJSON}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              aria-label="Copy property data as JSON"
            >
              {copied ? (
                <>
                  <FiCheck className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <FiCopy className="w-4 h-4" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile compact actions row */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 z-20 no-print shadow-lg">
        <div className="flex gap-2 max-w-7xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium disabled:opacity-70 shadow-sm"
            aria-label="Save deal"
          >
            <FiHeart className="w-4 h-4" />
            <span className="text-sm">{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            aria-label="Share property"
          >
            <FiShare2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            aria-label="Export as PDF"
          >
            <FiDownload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
