'use client';

type ExportMetric = {
  label: string;
  value: string;
};

export type PropertyPdfExportInput = {
  propertyId: string;
  property?: Record<string, unknown> | null;
  url?: string;
  price?: number;
  yieldPercent?: number;
  roiPercent?: number;
  discountPercent?: number;
  aiScore?: number;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const formatCurrency = (value: number | undefined): string => {
  if (typeof value !== 'number') return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | undefined): string => {
  if (typeof value !== 'number') return 'N/A';
  return `${value.toFixed(1)}%`;
};

const formatDate = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
};

const sanitizeFilenamePart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
};

const getText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const normalizeLineBreaks = (value: string): string => {
  return escapeHtml(value).replace(/\n/g, '<br/>');
};

export const createPropertyPdfFilename = (input: PropertyPdfExportInput): string => {
  const property = input.property ?? {};
  const title = getText(property.title);
  const location = getText(property.location);
  const idPart = sanitizeFilenamePart(input.propertyId || 'property');
  const titlePart = sanitizeFilenamePart(title ?? location ?? 'property-details');
  const ymd = new Date().toISOString().slice(0, 10);
  return `propnexus-${titlePart}-${idPart}-${ymd}.pdf`;
};

export const getPropertyPdfSections = (input: PropertyPdfExportInput): {
  heading: string;
  subtitle: string;
  metrics: ExportMetric[];
  overview: ExportMetric[];
  notes: string;
} => {
  const property = input.property ?? {};
  const title = getText(property.title) ?? `Property ${input.propertyId}`;
  const location = getText(property.location) ?? 'Location unavailable';

  const price = typeof input.price === 'number' ? input.price : toNumber(property.price);
  const rent =
    toNumber(property.monthly_rent) ??
    toNumber(property.rent_pcm) ??
    toNumber(property.rent_per_month) ??
    toNumber(property.rent);

  const metrics: ExportMetric[] = [
    { label: 'Price', value: formatCurrency(price) },
    { label: 'Estimated Rent (PCM)', value: formatCurrency(rent) },
    { label: 'Yield', value: formatPercent(input.yieldPercent) },
    { label: 'ROI', value: formatPercent(input.roiPercent) },
    { label: 'Discount', value: formatPercent(input.discountPercent) },
    {
      label: 'AI Score',
      value: typeof input.aiScore === 'number' ? `${input.aiScore.toFixed(1)}/10` : 'N/A',
    },
  ];

  const overview: ExportMetric[] = [
    { label: 'Property ID', value: input.propertyId || 'N/A' },
    { label: 'Title', value: title },
    { label: 'Location', value: location },
    { label: 'Property Type', value: getText(property.propertyType ?? property.property_type) ?? 'N/A' },
    { label: 'Investment Type', value: getText(property.investmentType ?? property.investment_type) ?? 'N/A' },
    {
      label: 'Bedrooms / Bathrooms',
      value: `${toNumber(property.bedrooms) ?? 'N/A'} / ${toNumber(property.bathrooms) ?? 'N/A'}`,
    },
    { label: 'Exported At', value: formatDate() },
    { label: 'Source URL', value: input.url ?? 'N/A' },
  ];

  const notes = getText(property.description) ?? 'No description provided.';

  return {
    heading: 'PropNexus Property Deal Export',
    subtitle: `${title} - ${location}`,
    metrics,
    overview,
    notes,
  };
};

const toList = (items: ExportMetric[]): string => {
  return items
    .map(
      (item) => `
        <div class="row">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="value">${escapeHtml(item.value)}</div>
        </div>
      `,
    )
    .join('');
};

const buildMarkup = (input: PropertyPdfExportInput): string => {
  const sections = getPropertyPdfSections(input);

  return `
    <div class="export-root">
      <style>
        .export-root { font-family: Arial, sans-serif; color: #0f172a; padding: 22px; background: #ffffff; }
        h1 { font-size: 22px; margin: 0; color: #0f172a; }
        .subtitle { margin-top: 6px; font-size: 13px; color: #475569; }
        .chip { display: inline-block; margin-top: 12px; font-size: 11px; padding: 5px 10px; border: 1px solid #cbd5e1; border-radius: 9999px; color: #334155; }
        .section { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
        .section-title { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .section-body { padding: 8px 12px; }
        .row { display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
        .row:last-child { border-bottom: none; }
        .label { font-size: 12px; color: #64748b; }
        .value { font-size: 13px; font-weight: 600; text-align: right; color: #0f172a; }
        .notes { margin-top: 10px; font-size: 12px; line-height: 1.55; color: #1e293b; }
        .footer { margin-top: 16px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>

      <h1>${escapeHtml(sections.heading)}</h1>
      <div class="subtitle">${escapeHtml(sections.subtitle)}</div>
      <div class="chip">Key sections: Deal Metrics, Overview, Notes</div>

      <div class="section">
        <div class="section-title">Deal Metrics</div>
        <div class="section-body">${toList(sections.metrics)}</div>
      </div>

      <div class="section">
        <div class="section-title">Property Overview</div>
        <div class="section-body">${toList(sections.overview)}</div>
      </div>

      <div class="section">
        <div class="section-title">Notes</div>
        <div class="section-body">
          <div class="notes">${normalizeLineBreaks(sections.notes)}</div>
        </div>
      </div>

      <div class="footer">Generated by PropNexus property detail export.</div>
    </div>
  `;
};

export async function exportPropertyPdf(input: PropertyPdfExportInput): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF export is only available in the browser.');
  }

  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default ?? html2pdfModule) as any;

  const mountNode = document.createElement('div');
  mountNode.setAttribute('data-testid', 'property-export-pdf-root');
  mountNode.style.position = 'fixed';
  mountNode.style.left = '-10000px';
  mountNode.style.top = '0';
  mountNode.style.width = '780px';
  mountNode.style.zIndex = '-1';
  mountNode.innerHTML = buildMarkup(input);

  document.body.appendChild(mountNode);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: createPropertyPdfFilename(input),
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(mountNode)
      .save();
  } finally {
    mountNode.remove();
  }
}
