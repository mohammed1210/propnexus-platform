// scripts/ingest-csv.ts
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

type Row = {
  external_id: string;
  title?: string;
  location?: string;
  price?: string | number;
  bedrooms?: string | number;
  bathrooms?: string | number;
  yield_percent?: string | number;
  roi_percent?: string | number;
  imageurl?: string;
  latitude?: string | number;
  longitude?: string | number;
};

function getArgFlag(name: string) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split('=')[1] : undefined;
}

function toNum(v: unknown): number | null {
  // accepts "125,000", "125000", 125000, "", null
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function sanitizeImage(url?: string | null): string | null {
  if (!url) return '/placeholder.jpg';
  const u = url.trim();
  if (!u) return '/placeholder.jpg';
  // Treat example.com (demo URLs) as missing -> use local placeholder
  if (/^https?:\/\/(?:www\.)?example\.com/i.test(u)) return '/placeholder.jpg';
  return u;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: npm run ingest:csv -- <path-to-csv> [--source=rightmove]');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`CSV not found: ${filePath}`);
    process.exit(1);
  }

  const explicitSource = getArgFlag('source'); // optional override

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const SUPABASE_KEY =
    // Prefer service role in local/dev for ingestion (bypasses RLS)
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      '❌ Missing Supabase env vars. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const csv = fs.readFileSync(filePath, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  if (!records.length) {
    console.log('No rows to ingest.');
    return;
  }

  // Map/clean rows
  const rows = records.map((r) => {
    let source = explicitSource || 'sample';
    let externalId = String(r.external_id ?? '').trim();

    // If the CSV uses "rightmove-1001" style, split it unless --source provided
    const hyphenIdx = externalId.indexOf('-');
    if (!explicitSource && hyphenIdx > 0) {
      source = externalId.slice(0, hyphenIdx).toLowerCase();
      externalId = externalId.slice(hyphenIdx + 1);
    }

    return {
      source, // requires columns: source text, external_id text (unique together)
      external_id: externalId,
      title: r.title ?? null,
      location: r.location ?? null,
      price: toNum(r.price),
      bedrooms: toNum(r.bedrooms),
      bathrooms: toNum(r.bathrooms),
      yield_percent: toNum(r.yield_percent),
      roi_percent: toNum(r.roi_percent),
      imageurl: sanitizeImage(r.imageurl ?? null),
      latitude: toNum(r.latitude),
      longitude: toNum(r.longitude),
    };
  });

  // Upsert in chunks to be nice on the API
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error, status, statusText, count } = await supabase
      .from('properties')
      .upsert(chunk, {
        onConflict: 'source,external_id',
        ignoreDuplicates: false,
        count: 'exact', // ✅ moved from .select(...) to here (TS-friendly)
      })
      .select('*');

    if (error) {
      console.error(`Upsert failed [${status} ${statusText}]`, error);
      process.exit(1);
    }
    console.log(`Upserted ${chunk.length} rows (reporting count: ${count ?? 'n/a'})`);
  }

  console.log('Done ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});