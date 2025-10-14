export const fmtGBP = (v?: number | null) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format((v ?? 0) as number);

export const fmtPct = (v?: number | null) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);

export const plural = (n?: number | null, noun?: string) =>
  `${n ?? 0} ${noun}${(n ?? 0) === 1 ? '' : 's'}`;
