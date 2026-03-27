'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function StripePortalButton() {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
      }

      if (!data?.url) {
        throw new Error('No portal URL returned');
      }

      toast.success('Redirecting to billing portal...');
      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to open customer portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={openPortal}
      disabled={loading}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition
        ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}
        bg-primary text-white`}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-4 w-4 mr-2 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          Opening...
        </>
      ) : (
        'Manage Subscription'
      )}
    </button>
  );
}
