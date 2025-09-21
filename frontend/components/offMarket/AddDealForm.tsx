'use client';

import { useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Props = { onCreated?: () => void };

// basic form shape
type FormState = {
  title: string;
  location: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  investment_type: string;
  contact: string;
  source: string;
  notes: string;
};

const initialState: FormState = {
  title: '',
  location: '',
  price: '',
  bedrooms: '',
  bathrooms: '',
  investment_type: 'HMO',
  contact: '',
  source: 'Manual',
  notes: '',
};

export default function AddDealForm({ onCreated }: Props) {
  const sb = useMemo(() => getSupabase(), []);
  const [f, setF] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 1) Upload selected photos (if any) to Supabase Storage
      const files = fileInputRef.current?.files ?? null;
      let imageUrl: string | null = null;

      if (files && files.length > 0) {
        const bucket = sb.storage.from('off-market');

        // upload sequentially; first uploaded will be used as card cover
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const path = `deals/${Date.now()}-${i}.${ext}`;

          const { error: upErr } = await bucket.upload(path, file, { upsert: false });
          if (upErr) throw upErr;

          const { data: pub } = bucket.getPublicUrl(path);
          if (!pub?.publicUrl) throw new Error('Failed to create public URL for upload.');

          // first image becomes the card image
          if (!imageUrl) imageUrl = pub.publicUrl;
        }
      }

      // 2) Insert the deal row (including image_url if present)
      const payload = {
        title: f.title || null,
        location: f.location || null,
        price: f.price ? Number(f.price) : null,
        bedrooms: f.bedrooms ? Number(f.bedrooms) : null,
        bathrooms: f.bathrooms ? Number(f.bathrooms) : null,
        investment_type: f.investment_type || null,
        contact: f.contact || null,
        source: f.source || 'Manual',
        notes: f.notes || null,
        image_url: imageUrl, // <-- shows on the card
      };

      const { error: insertErr } = await sb.from('off_market_deals').insert([payload]);
      if (insertErr) throw insertErr;

      // 3) Reset + notify parent
      setF(initialState);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to add deal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* left */}
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-zinc-600">Title</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2"
                 value={f.title} onChange={set('title')} placeholder="Spacious 3-bed semi" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Price (£)</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2" inputMode="numeric"
                 value={f.price} onChange={set('price')} placeholder="250000" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Bedrooms</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2" inputMode="numeric"
                 value={f.bedrooms} onChange={set('bedrooms')} placeholder="3" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Contact (email)</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2"
                 value={f.contact} onChange={set('contact')} placeholder="agent@agency.co.uk" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Photos</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">First image will be used as the card cover.</p>
        </label>
      </div>

      {/* right */}
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-zinc-600">Location *</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2"
                 value={f.location} onChange={set('location')} placeholder="Liverpool" required />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Investment Type</span>
          <select className="mt-1 w-full rounded-md border px-3 py-2"
                  value={f.investment_type} onChange={set('investment_type')}>
            <option>HMO</option>
            <option>Single-let</option>
            <option>BRR</option>
            <option>Flip</option>
            <option>Serviced Accom</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Bathrooms</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2" inputMode="numeric"
                 value={f.bathrooms} onChange={set('bathrooms')} placeholder="1" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Source</span>
          <input className="mt-1 w-full rounded-md border px-3 py-2"
                 value={f.source} onChange={set('source')} placeholder="Manual / Agent / Portal" />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Notes</span>
          <textarea className="mt-1 w-full rounded-md border px-3 py-2 min-h-[84px]"
                    value={f.notes} onChange={set('notes')}
                    placeholder="Key details, works required, yield/ROI notes..." />
        </label>
      </div>

      {error && (
        <div className="md:col-span-2 text-sm text-red-600">{error}</div>
      )}

      <div className="md:col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add Deal'}
        </button>
        <button
          type="button"
          onClick={() => {
            setF(initialState);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setError(null);
          }}
          className="rounded-lg border px-4 py-2"
        >
          Reset
        </button>
      </div>
    </form>
  );
}