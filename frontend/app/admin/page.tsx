export const metadata = { title: 'Admin • PropNexus' };

export default async function AdminPage() {
  // TODO: replace with server-side Supabase query for real stats
  const stats = {
    subscribers: 0,
    mrrGBP: 0,
    investorTier: 0,
  };
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
      <ul className="space-y-2">
        <li>Total Subscribers: {stats.subscribers}</li>
        <li>MRR (GBP): £{stats.mrrGBP}</li>
        <li>Investor Tier: {stats.investorTier}</li>
      </ul>
    </main>
  );
}
