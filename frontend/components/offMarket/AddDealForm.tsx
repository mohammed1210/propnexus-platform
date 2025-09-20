'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabaseClient';

type Props = {
  onCreated?: () => void; // call to refresh list
}

export default function AddDealForm({ onCreated }: Props) {
  const sb = getSupabase();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [investmentType, setInvestmentType] = useState('HMO');
  const [contact, setContact] = useState('');
  const [source, setSource] = useState('Manual');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // simple client validation
    if (!title.trim()) return setError('Title is required');
    if (!location.trim()) return setError('Location is required');
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return setError('Price must be a positive number');
    }

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        location: location.trim(),
        price: priceNum,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        investment_type: investmentType || null,
        contact: contact || null,
        source: source || 'Manual',
        notes: notes || null,
        created_at: new Date().toISOString(),
      };

      const { error } = await sb.from('off_market_deals').insert([payload]);
      if (error) throw error;

      // reset + ping parent
      setTitle(''); setLocation(''); setPrice('');
      setBedrooms(''); setBathrooms('');
      setInvestmentType('HMO'); setContact(''); setSource('Manual'); setNotes('');
      onCreated?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save deal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Title (e.g. 3 Bed Semi in Hackney)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Location (e.g. London, UK)"
        value={location}
        onChange={e => setLocation(e.target.value)}
      />
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Price (£)"
        inputMode="numeric"
        value={price}
        onChange={e => setPrice(e.target.value)}
      />
      <div className="flex gap-3">
        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Beds"
          inputMode="numeric"
          value={bedrooms}
          onChange={e => setBedrooms(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Baths"
          inputMode="numeric"
          value={bathrooms}
          onChange={e => setBathrooms(e.target.value)}
        />
      </div>
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Investment Type (e.g. HMO, BTL)"
        value={investmentType}
        onChange={e => setInvestmentType(e.target.value)}
      />
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Contact email (optional)"
        value={contact}
        onChange={e => setContact(e.target.value)}
      />
      <input
        className="border rounded-lg px-3 py-2"
        placeholder="Source (e.g. Agent XYZ)"
        value={source}
        onChange={e => setSource(e.target.value)}
      />
      <textarea
        className="border rounded-lg px-3 py-2 sm:col-span-2"
        placeholder="Notes (optional)"
        rows={3}
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      {error && (
        <div className="sm:col-span-2 text-sm text-red-600">{error}</div>
      )}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Add Deal'}
        </button>
      </div>
    </form>
  );
}
