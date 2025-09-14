// scripts/ingest-live.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { scrapeRightmove } from './sources/rightmove';

type PropertyRow = {
  source: string;
  source_id: string;
  title: string;
  location: string;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // computed/optional fields frontend already understands:
  yield_percent?: number | null;
  roi_percent?: number | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Collect all RM_SEARCH_* envs dynamically so you can add/remove cities in .env/Railway
const SEARCHES: { name: string; url: string }[] = Object.entries(process.env)
  .filter(([k, v]) => k.startsWith('RM_SEARCH_') && typeof v === 'string' && v.length > 0)
  .map(([k, url]) => ({ name: k, url: url as string }));

async function upsert(rows: PropertyRow[]) {
  if (!rows.length) return { count: 0 };
  const { error } = await sb.from('properties').upsert(rows, { onConflict: 'source,source_id' });
  if (error) throw error;
  return { count: rows.length };
}

function computeDerived(row: PropertyRow): PropertyRow {
  // Placeholder: very rough rent proxy; replace with your model later.
  const estRent = Math.round(row.price * 0.005); // ~0.5% rule
  const yieldPct = row.price ? (estRent * 12) / row.price * 100 : null;

  return {
    ...row,
    yield_percent: yieldPct ? Number(yieldPct.toFixed(1)) : null,
    roi_percent: null,
  };
}

async function run() {
  console.log(`[Ingest] Starting live scrape… (${new Date().toISOString()})`);

  if (!SEARCHES.length) {
    console.warn('No RM_SEARCH_* envs found. Add some to .env or Railway Variables.');
    return;
  }

  let total = 0;

  for (const s of SEARCHES) {
    console.log(`• Scraping: ${s.name}`);
    try {
      const items = await scrapeRightmove(s.url);
      const rows = items.map<PropertyRow>((i) =>
        computeDerived({
          source: i.source,
          source_id: i.source_id,
          title: i.title,
          location: i.location,
          price: i.price,
          bedrooms: i.bedrooms ?? null,
          bathrooms: i.bathrooms ?? null,
          imageurl: i.imageurl ?? null,
          latitude: i.latitude ?? null,
          longitude: i.longitude ?? null,
        })
      );

      const { count } = await upsert(rows);
      total += count;
      console.log(`  → upserted ${count} rows`);
    } catch (e: any) {
      console.error(`  ✖ ${s.name} failed:`, e?.message || e);
    }
  }

  console.log(`[Ingest] Done. Upserted ${total} rows.`);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});