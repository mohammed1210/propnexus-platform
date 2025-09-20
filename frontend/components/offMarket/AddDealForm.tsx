'use client';

import { FormEvent, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '@/lib/supabaseClient';

type Props = {
  onCreated?: () => void;
};

export default function AddDealForm({ onCreated }: Props) {
  const sb = useMemo(() => getSupabase(), []);

  // Basic fields
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [investmentType, setInvestmentType] = useState('HMO');
  const [contact, setContact] = useState('');
  const [source, setSource] = useState('Manual');
  const [notes, setNotes] = useState('');

  // Images
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setLocation('');
    setPrice('');
    setBedrooms('');
    setBathrooms('');
    setInvestmentType('HMO');
    setContact('');
    setSource('Manual');
    setNotes('');
    setFiles([]);
  };

  async function uploadImagesToStorage(fs: File[]) {
    if (!fs.length) return [] as string[];

    // Ensure the bucket exists & is public (Dashboard → Storage → New bucket → "off-market" → Public)
    const bucket = sb.storage.from('off-market');
    const dir = uuidv4(); // folder for this deal

    const urls: string[] = [];

    for (const f of fs) {
      const ext = f.name.split('.').pop() || 'jpg';
      const path = `${dir}/${uuidv4()}.${ext}`;

      const { error: upErr } = await bucket.upload(path, f, {
        cacheControl: '3600',
        upsert: false,
        contentType: f.type || 'image/jpeg',
      });
      if (upErr) throw upErr;

      const { data } = bucket.getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }

    return urls;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      alert('Location is required.');
      return;
    }
    const priceNum = price ? Number(price) : null;
    if (price && !Number.isFinite(priceNum)) {
      alert('Price must be a number.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upload images (if any) → public URLs
      const imageUrls = await uploadImagesToStorage(files);
      const heroUrl = imageUrls[0] || null;

      // 2) Build row for insert
      const row: Record<string, any> = {
        title: title || null,
        location: location || null,
        price: priceNum,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        investment_type: investmentType || null,
        contact: contact || null,
        source: source || 'Manual',
        notes: notes || null,
        created_at: new Date().toISOString(),
        image_url: heroUrl, // <- top-of-card image
        // TODO: If you add a `image_urls jsonb` column later, you can also send:
        // image_urls: imageUrls,
      };

      // 3) Insert
      const { error } = await sb.from('off_market_deals').insert(row);
      if (error) throw error;

      resetForm();
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to add deal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Title</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Spacious 3-bed semi"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Location *</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Liverpool"
          value={location}
          onChange={e => setLocation(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Price (£)</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="250000"
          inputMode="numeric"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Investment Type</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="HMO"
          value={investmentType}
          onChange={e => setInvestmentType(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Bedrooms</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="3"
          inputMode="numeric"
          value={bedrooms}
          onChange={e => setBedrooms(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Bathrooms</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="1"
          inputMode="numeric"
          value={bathrooms}
          onChange={e => setBathrooms(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Contact (email)</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="agent@agency.co.uk"
          type="email"
          value={contact}
          onChange={e => setContact(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm opacity-70">Source</label>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Manual"
          value={source}
          onChange={e => setSource(e.target.value)}
        />
      </div>

      {/* Images (multiple) */}
      <div className="md:col-span-2 flex flex-col gap-2">
        <label className="text-sm opacity-70">Photos</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={e => setFiles(Array.from(e.target.files || []))}
          className="block"
        />
        {files.length > 0 && (
          <div className="text-xs opacity-70">
            {files.length} file{files.length > 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      <div className="md:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add Deal'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={submitting}
          className="rounded-lg border px-4 py-2"
        >
          Reset
        </button>
      </div>

      <div className="md:col-span-2">
        <label className="text-sm opacity-70">Notes</label>
        <textarea
          className="mt-2 border rounded-lg px-3 py-2 w-full min-h-[90px]"
          placeholder="Add key details, works required, yield/ROI notes, etc."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
    </form>
  );
}
