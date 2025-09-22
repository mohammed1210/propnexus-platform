'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

// tiny classnames helper
function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(' ');
}

type Property = {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  imageurl?: string | null;
};

function getBackendBase(): string {
  const raw =
    (process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      '') as string;
  if (!raw) throw new Error('NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_BACKEND_URL) is not set');
  return raw.replace(/\/+$/, '');
}

export default function PropertyCard({ p }: { p: Property }) {
  const [saving, setSaving] = useState(false);

  async function handleSaveDeal() {
    try {
      setSaving(true);
      const base = getBackendBase();
      const resp = await fetch(`${base}/save-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: p.id }),
      });
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
      alert('Deal saved!');
    } catch (e) {
      console.error(e);
      alert('Could not save this deal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950">
      <Link href={`/property/${encodeURIComponent(p.id)}`} className="block relative w-full h-48">
        <Image
          src={p.imageurl || '/placeholder.jpg'}
          alt={p.title || 'Property image'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          style={{ objectFit: 'cover' }}
          priority={false}
        />
      </Link>

      <div className="p-4 space-y-2">
        <Link href={`/property/${encodeURIComponent(p.id)}`} className="block">
          <h3 className="font-semibold leading-snug line-clamp-2">
            {p.title || 'Untitled property'}
          </h3>
        </Link>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {p.location || '—'}
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            <span className="font-medium">£{Number(p.price ?? 0).toLocaleString()}</span>
            <span className="opacity-60 ml-2">
              {p.bedrooms ?? '—'} bd · {p.bathrooms ?? '—'} ba
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveDeal}
            disabled={saving}
            className={cx(
              'rounded-md px-3 py-1.5 text-sm border',
              'hover:bg-zinc-100 dark:hover:bg-zinc-800',
              saving && 'opacity-60 cursor-not-allowed'
            )}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  );
}
