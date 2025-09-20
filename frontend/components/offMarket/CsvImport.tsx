'use client';

import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { getSupabase } from '@/lib/supabaseClient';

type Props = { onImported?: () => void };

export default function CsvImport({ onImported }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sb = getSupabase();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    setBusy(true);
    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (r) => resolve(r.data as any[]),
          error: reject,
        });
      });

      // map CSV rows -> table shape
      const nowIso = new Date().toISOString();
      const rows = parsed.map((r, i) => ({
        title: r.title || r.address || `Imported deal ${i + 1}`,
        location: r.location ?? null,
        price: r.price ? Number(r.price) : null,
        bedrooms: r.bedrooms ? Number(r.bedrooms) : null,
        bathrooms: r.bathrooms ? Number(r.bathrooms) : null,
        investment_type: r.investment_type ?? null,
        contact: r.contact ?? null,
        source: r.source ?? 'CSV',
        notes: r.notes ?? null,
        created_at: nowIso,
      }));

      const { error } = await sb.from('off_market_deals').insert(rows);
      if (error) throw error;

      onImported?.();
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setErr(e?.message || 'Failed to import CSV');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        disabled={busy}
      >
        {busy ? 'Importing…' : 'Import CSV'}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
