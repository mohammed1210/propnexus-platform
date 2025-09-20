'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';

type Props = {
  onCreated?: () => Promise<void> | void;
};

export default function AddDealForm({ onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [investmentType, setInvestmentType] = useState<string>('HMO');
  const [contact, setContact] = useState('');
  const [source, setSource] = useState('Manual');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);

    try {
      const body = {
        title: title.trim(),
        location: location.trim(),
        price: price ? Number(price) : null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        investment_type: investmentType || null,
        contact: contact || null,
        source: source || 'Manual',
        notes: notes || null,
      };

      // If you set OFF_MARKET_ADMIN_TOKEN on the backend, add it here (or read from env)
      const headers: HeadersInit = {};
      const token = process.env.NEXT_PUBLIC_OFF_MARKET_ADMIN_TOKEN;
      if (token) headers['X-API-Key'] = token;

      await apiPost('/off-market/create', body, { headers });

      setOk(true);
      setTitle('');
      setLocation('');
      setPrice('');
      setBedrooms('');
      setBathrooms('');
      setInvestmentType('HMO');
      setContact('');
      setSource('Manual');
      setNotes('');

      await onCreated?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add deal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="grid gap-1">
        <label className="text-sm opacity-70">Title *</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="Spacious 3-bed semi"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm opacity-70">Location *</label>
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="Liverpool"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm opacity-70">Price (£)</label>
        <input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="250000"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm opacity-70">Investment Type</label>
        <select
          value={investmentType}
          onChange={(e) => setInvestmentType(e.target.value)}
          className="border rounded-lg px-3 py-2"
        >
          <option value="HMO">HMO</option>
          <option value="Flip">Flip</option>
          <option value="BRRR">BRRR</option>
          <option value="Rent-to-Rent">Rent-to-Rent</option>
          <option value="Single-let">Single-let</option>
        </select>
      </div>

      <div className="grid gap-1">
        <label className="text-sm opacity-70">Bedrooms</label>
        <input
          inputMode="numeric"
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="3"
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm opacity-70">Bathrooms</label>
        <input
          inputMode="numeric"
          value={bathrooms}
          onChange={(e) => setBathrooms(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="1"
        />
      </div>

      <div className="grid gap-1 md:col-span-2">
        <label className="text-sm opacity-70">Contact (email)</label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="agent@agency.co.uk"
        />
      </div>

      <div className="grid gap-1 md:col-span-2">
        <label className="text-sm opacity-70">Source</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border rounded-lg px-3 py-2"
          placeholder="Vendor, Sourcing partner, CSV, ..."
        />
      </div>

      <div className="grid gap-1 md:col-span-2">
        <label className="text-sm opacity-70">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border rounded-lg px-3 py-2"
          rows={3}
          placeholder="Add key details, works required, yield/ROI notes, etc."
        />
      </div>

      <div className="md:col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Add Deal'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        {ok && <span className="text-sm text-emerald-600">Saved!</span>}
      </div>
    </form>
  );
}