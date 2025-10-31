export const metadata = { title: 'Manage Subscription • PropNexus' };

async function openPortal() {
  const res = await fetch('/api/stripe/portal', { method: 'POST' });
  const data = await res.json();
  if (data?.url) window.location.href = data.url;
  else alert(data?.error || 'Could not open portal');
}

export default function BillingAccountPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold mb-4">Manage your subscription</h1>
      <p className="opacity-70 mb-6">Update payment method, change plan, or cancel anytime.</p>
      <button className="btn" onClick={openPortal}>Open Customer Portal</button>
    </main>
  );
}
