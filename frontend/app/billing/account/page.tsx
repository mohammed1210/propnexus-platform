// frontend/app/billing/account/page.tsx
'use client';

async function openPortal() {
  try {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert(data?.error || 'Could not open portal');
    }
  } catch (e) {
    console.error(e);
    alert('Portal request failed');
  }
}

export default function BillingAccountPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold mb-4">Manage your subscription</h1>
      <p className="opacity-70 mb-6">
        Update payment method, change plan, or cancel anytime.
      </p>
      <button
        className="btn mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={openPortal}
      >
        Open Customer Portal
      </button>
    </main>
  );
}
