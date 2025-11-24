import { supabaseServer } from '@/lib/supabaseServer';

export const metadata = { title: 'Admin • PropNexus' };

async function getAdminStats() {
  try {
    const supabase = supabaseServer();
    if (!supabase) {
      console.warn('Supabase client is not available. Admin stats will be zero.');
      return { subscribers: 0, mrrGBP: 0, investorTier: 0 };
    }

    // Get total number of active subscriptions
    const { count: activeSubscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['trialing', 'active']);

    if (subsError) throw subsError;

    // Calculate MRR
    const { data: subscriptions, error: mrrError } = await supabase
      .from('subscriptions')
      .select('*, prices(*, products(*))')
      .in('status', ['trialing', 'active']);

    if (mrrError) throw mrrError;

    const mrrGBP =
      subscriptions
        ?.filter(
          (s) =>
            s.prices?.products?.metadata?.tier === 'investor' &&
            s.prices?.currency === 'gbp'
        )
        .reduce((total, s) => total + (s.prices?.unit_amount || 0), 0) / 100;

    // Get number of investor tier subscribers
    const investorTier =
      subscriptions?.filter(
        (s) => s.prices?.products?.metadata?.tier === 'investor'
      ).length || 0;

    return {
      subscribers: activeSubscriptions ?? 0,
      mrrGBP: mrrGBP ?? 0,
      investorTier: investorTier,
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return {
      subscribers: 0,
      mrrGBP: 0,
      investorTier: 0,
    };
  }
}

export default async function AdminPage() {
  const stats = await getAdminStats();
  const supabase = supabaseServer();

  if (!supabase) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">
            Admin dashboard is not available.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Please ensure Supabase environment variables are configured correctly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Admin Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-lg font-medium">Subscribers</h3>
              <p className="text-2xl font-bold">{stats.subscribers}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">MRR (GBP)</h3>
              <p className="text-2xl font-bold">{stats.mrrGBP}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Investor Tier</h3>
              <p className="text-2xl font-bold">{stats.investorTier}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
