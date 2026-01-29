import type { OffMarketDeal } from './types';

export function primaryImageUrl(deal: Partial<OffMarketDeal>): string | null {
  if (deal.image_url) return deal.image_url;
  if (deal.imageurl) return deal.imageurl;
  const first =
    deal.image_urls && Array.isArray(deal.image_urls) && deal.image_urls.length > 0
      ? deal.image_urls[0]
      : null;
  return first || null;
}

export function computeInvestmentScore(deal: Partial<OffMarketDeal>): number {
  const price = toNum(deal.price);
  const value = toNum(deal.estimated_value);
  const refurb = toNum(deal.refurb_cost);
  const rent = toNum(deal.rent_potential);

  if (!price || !value) return 0;

  const priceScore = Math.min(40, ((value - price) / value) * 40);
  const refurbPenalty = refurb ? Math.min(20, (refurb / 20000) * 20) : 0;
  const rentBoost = rent ? Math.min(30, (rent / 1500) * 30) : 0;

  return Math.round(Math.max(0, Math.min(100, priceScore + rentBoost - refurbPenalty)));
}

export function ensureDerivedFields(deal: OffMarketDeal): OffMarketDeal {
  const price = toNum(deal.asking_price ?? deal.price);
  const value = toNum(deal.estimated_value);
  let discount: number | null = deal.discount_percent ?? null;
  if (discount == null && price && value) {
    discount = ((value - price) / value) * 100;
  }

  // Backward-compat: older rows may have score=0 simply because the column
  // didn't exist yet when the row was created. Treat 0 as "missing" so we can
  // fall back to a derived score for display.
  const backendScore = deal.score != null && deal.score > 0 ? deal.score : null;
  const legacyScore =
    deal.investment_score != null && deal.investment_score > 0 ? deal.investment_score : null;
  const score = backendScore ?? legacyScore ?? computeInvestmentScore({ ...deal, price });
  return {
    ...deal,
    asking_price: deal.asking_price ?? price,
    price: deal.price ?? price,
    discount_percent: discount,
    investment_score: score,
    score,
  };
}

export function formatCurrency(amount?: number | null): string {
  const v = toNum(amount);
  if (!v) return '£0';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number | null | undefined);
  return Number.isFinite(n as number) ? (n as number) : null;
}

export function parseCSV(csvText: string): Partial<OffMarketDeal>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const out: Partial<OffMarketDeal>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Partial<OffMarketDeal> = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    } as any;

    headers.forEach((header, idx) => {
      const value = values[idx];
      if (value == null || value === '') return;
      switch (header) {
        case 'title':
          row.title = value; break;
        case 'address':
          row.address = value; break;
        case 'postcode':
          row.postcode = value.toUpperCase(); break;
        case 'location':
          row.location = value; break;
        case 'price':
          row.price = Number(value.replace(/[^0-9.]/g, '')); break;
        case 'estimated_value':
        case 'value':
          row.estimated_value = Number(value.replace(/[^0-9.]/g, '')); break;
        case 'refurb_cost':
        case 'refurb':
          row.refurb_cost = Number(value.replace(/[^0-9.]/g, '')); break;
        case 'rent_potential':
        case 'rent':
          row.rent_potential = Number(value.replace(/[^0-9.]/g, '')); break;
        case 'agent_name':
        case 'agent':
          row.agent_name = value; break;
        case 'agent_phone':
        case 'phone':
          row.agent_phone = value; break;
        case 'notes':
          row.notes = value; break;
        case 'imageurl':
        case 'image':
          row.imageurl = value; break;
        case 'source':
          row.source = value; break;
        case 'status':
          row.status = value; break;
      }
    });

    // derive
    if (row.title && row.price && row.estimated_value) {
      row.discount_percent = ((toNum(row.estimated_value) || 0) - (toNum(row.price) || 0)) /
        (toNum(row.estimated_value) || 1) * 100;
      row.investment_score = computeInvestmentScore(row);
    }
    out.push(row);
  }
  return out;
}
