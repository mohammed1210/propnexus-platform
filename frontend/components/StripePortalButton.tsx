'use client';

import { useState } from 'react';
import { toast } from 'sonner'; // ✅ ensure installed: npm i sonner

export default function StripePortalButton({ email }: { email?: string }) {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    if (!email) {
      toast.error('No email found. Please log in first.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

      if (data?.url) {
        toast.success('Redirecting to billing portal...');
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          Opening...
        </>
      ) : (
        'Manage Subscription'
      )}
    </button>
  );
}
