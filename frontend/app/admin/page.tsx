import { supabaseServer } from '@/lib/supabaseServer';

export const metadata = { title: 'Admin • PropNexus' };

async function getAdminStats() {
  try {
    const supabase = supabaseServer();

    // Get total number of active subscriptions
    const { count: activeSubscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
    }

    // Get all active subscriptions to calculate MRR
    const { data: subscriptions, error: subDataError } = await supabase
      .from('subscriptions')
      .select('price_id, status')
      .eq('status', 'active');

    if (subDataError) {
      console.error('Error fetching subscription data:', subDataError);
    }

    // Calculate MRR based on price IDs
    // Note: In production, consider fetching actual prices from Stripe API for accuracy
    const priceMap: { [key: string]: number } = {
      [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || '']: parseFloat(
        process.env.NEXT_PUBLIC_STRIPE_AMOUNT_PRO || '29',
      ),
      [process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR || '']: parseFloat(
        process.env.NEXT_PUBLIC_STRIPE_AMOUNT_INVESTOR || '99',
      ),
    };

    let mrrGBP = 0;
    let investorTierCount = 0;

    if (subscriptions) {
      for (const sub of subscriptions) {
        const price = priceMap[sub.price_id] || 0;
        mrrGBP += price;
        if (sub.price_id === process.env.NEXT_PUBLIC_STRIPE_PRICE_INVESTOR) {
          investorTierCount++;
        }
      }
    }

    return {
      subscribers: activeSubscriptions || 0,
      mrrGBP,
      investorTier: investorTierCount,
    };
  } catch (error) {
    console.error('Error getting admin stats:', error);
    return {
      subscribers: 0,
      mrrGBP: 0,
      investorTier: 0,
    };
  }
}

export default async function AdminPage() {
  const stats = await getAdminStats();

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="border-b pb-2">
          <p className="text-sm text-gray-600">Total Active Subscribers</p>
          <p className="text-3xl font-bold">{stats.subscribers}</p>
        </div>
        <div className="border-b pb-2">
          <p className="text-sm text-gray-600">Monthly Recurring Revenue (GBP)</p>
          <p className="text-3xl font-bold">£{stats.mrrGBP.toFixed(2)}</p>
        </div>
        <div className="pb-2">
          <p className="text-sm text-gray-600">Investor Tier Subscribers</p>
          <p className="text-3xl font-bold">{stats.investorTier}</p>
        </div>
      </div>
    </main>
  );
}
