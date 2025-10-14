export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const tiers = [
    { name: 'Free', price: '£0', features: ['Basic search', 'View listings'] },
    { name: 'Pro', price: '£19/mo', features: ['Saved deals', 'Deal scoring', 'PDF exports'] },
    { name: 'Teams', price: '£49/mo', features: ['3 seats', 'CRM export', 'Priority support'] },
  ];

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-2">Pricing</h1>
      <p className="text-sm opacity-80 mb-6">Choose a plan to unlock premium features.</p>
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className="border rounded-lg p-5">
            <div className="text-xl font-medium">{t.name}</div>
            <div className="text-3xl my-2">{t.price}</div>
            <ul className="text-sm space-y-1">
              {t.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
