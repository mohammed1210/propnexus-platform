'use client';

import { useState } from 'react';
import { FiHeart, FiShare2, FiDownload, FiCopy, FiCheck } from 'react-icons/fi';

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
      } catch (err) {
        // User cancelled share
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        // TODO: Show toast notification
        console.log('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy link');
      }
    }
  };

  const handleExportPDF = () => {
    // TODO: Integrate with PDF export
    console.log('PDF export coming soon!');
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
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Desktop version (inline in sidebar) */}
      <div className="hidden lg:block space-y-2">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-70"
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
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <FiShare2 className="w-4 h-4" />
          <span>Share</span>
        </button>

        <button
          onClick={handleExportPDF}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <FiDownload className="w-4 h-4" />
          <span>Export PDF</span>
        </button>

        <button
          onClick={handleCopyJSON}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
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

      {/* Mobile compact actions row (fixed bottom bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-3 z-20">
        <div className="flex gap-2 max-w-7xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium"
          >
            <FiHeart className="w-4 h-4" />
            <span className="text-sm">{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700"
          >
            <FiShare2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700"
          >
            <FiDownload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
