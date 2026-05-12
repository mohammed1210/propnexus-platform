'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function SaveSearchAlert({ query, filters, sort }: { query: string; filters: Record<string, unknown>; sort: string }) {
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState('prime,strong');

  async function save() {
    setSaving(true);
    try {
      const include_tiers = tier.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch('/api/investor-alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: query ? `Deals for ${query}` : 'Saved deal alert',
          search_query: query,
          filters: { ...filters, sort },
          min_discovery_score: include_tiers.includes('watchlist') ? 45 : 60,
          include_tiers,
          frequency: 'daily',
          active: true,
        }),
      });
      if (!res.ok) throw new Error('Unable to save alert');
      toast.success('Deal alert created');
    } catch (err: any) {
      toast.error(err?.message || 'Could not create alert');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-white/80 px-3 py-2 text-xs shadow-sm dark:border-brand-900/50 dark:bg-slate-950/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-black text-slate-900 dark:text-white">Save this search</div>
          <div className="text-slate-500 dark:text-slate-400">Create a daily alert for newly surfaced investor leads.</div>
        </div>
        <div className="flex items-center gap-2">
          <select value={tier} onChange={(e) => setTier(e.target.value)} className="input-field" style={{ height: 36, padding: '0.35rem 0.5rem' }}>
            <option value="prime,strong">Prime + strong only</option>
            <option value="prime,strong,watchlist">Include watchlist</option>
          </select>
          <button onClick={save} disabled={saving} className="rounded-lg bg-brand-500 px-3 py-2 font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Create deal alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
