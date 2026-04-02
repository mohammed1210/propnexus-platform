'use client';

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { getRoiDisplay, getYieldPercent } from '@/lib/normalizeProperty';
import { buildPdfImageProxyPath, isUnsafePdfImageUrl } from '@/lib/pdfImageProxy';

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

type PropertyPdfSections = {
  brandTitle: string;
  reportTitle: string;
  reportSubtitle: string;
  title: string;
  location: string;
  titleMeta: ExportMetric[];
  metrics: ExportMetric[];
  highlights: string[];
  investmentInsight: string;
  overview: ExportMetric[];
  notes: string;
  hasNarrativeDescription: boolean;
  exportedAt: string;
  sourceUrl: string;
  imageUrl?: string;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toCurrencyNumber = (value: unknown): number | undefined => {
  const direct = toNumber(value);
  if (typeof direct === 'number') return direct;
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .trim()
    .replace(/,/g, '')
    .replace(/[\u00A0\s]+/g, ' ')
    .toLowerCase();

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveRentMonthly = (property: Record<string, unknown>): number | undefined => {
  const rentCandidates: unknown[] = [
    property.monthly_rent,
    property.rent_monthly,
    property.monthlyRent,
    property.rent_pcm,
    property.rent_per_month,
    property.rentPerMonth,
    property.rent,
  ];

  for (const candidate of rentCandidates) {
    const parsed = toCurrencyNumber(candidate);
    if (typeof parsed === 'number') return parsed;
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

const IMAGE_DIRECT_FIELDS = ['imageUrl', 'image_url', 'imageurl', 'thumbnail', 'cover_photo_url'] as const;
const IMAGE_COLLECTION_FIELDS = ['image_urls', 'imageUrls', 'images', 'photos'] as const;
const IMAGE_OBJECT_KEYS = ['url', 'src', 'imageUrl', 'image_url'] as const;
const MAX_INSIGHT_LENGTH = 420;

const getImageCandidateUrl = (value: unknown): string | undefined => {
  const direct = getText(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object') return undefined;

  for (const key of IMAGE_OBJECT_KEYS) {
    const url = getText((value as Record<string, unknown>)[key]);
    if (url) return url;
  }

  return undefined;
};

const parseImageCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const text = getText(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Resolves the best available listing image from the property payload.
 * Direct fields win first; collection fields support raw arrays, JSON-stringified arrays,
 * and arrays of objects containing common image URL keys.
 */
export const resolvePrimaryImageUrl = (property: Record<string, unknown>): string | undefined => {
  for (const field of IMAGE_DIRECT_FIELDS) {
    const url = getImageCandidateUrl(property[field]);
    if (url) return url;
  }

  for (const field of IMAGE_COLLECTION_FIELDS) {
    for (const candidate of parseImageCollection(property[field])) {
      const url = getImageCandidateUrl(candidate);
      if (url) return url;
    }
  }

  return undefined;
};

const createEmptyNotesState = (property: Record<string, unknown>): string => {
  const title = getText(property.title) ?? 'This property';
  return `${title} does not currently include a narrative description. This report still captures the core investment metrics, property overview, and source link for review.`;
};

const normalizeNarrativeText = (value: string): string => {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
};

const cleanNarrativeSegment = (value: string): string => {
  return value
    .replace(/^[\s•*\-,:;]+/, '')
    .replace(/[\s,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const trimTextLength = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength - 1);
  const trimmed = slice.slice(0, Math.max(0, slice.lastIndexOf(' '))).trim();
  return `${trimmed || slice.trim()}…`;
};

const createFallbackHighlights = (
  location: string,
  propertyType: string,
  investmentType: string,
  bedrooms?: number,
  bathrooms?: number,
): string[] => {
  return [
    `${propertyType} opportunity in ${location}`,
    `Investment profile: ${investmentType}`,
    `Accommodation: ${bedrooms ?? 'N/A'} bedrooms and ${bathrooms ?? 'N/A'} bathrooms`,
  ];
};

const extractDealHighlights = (
  description: string | undefined,
  fallbackHighlights: string[],
): string[] => {
  if (!description) return fallbackHighlights;

  const normalized = normalizeNarrativeText(description);
  const rawSegments = normalized
    .split(/(?:\n+|[•*]+|;\s+|,\s+)/)
    .flatMap((segment) => segment.split(/(?<=[.!?])\s+/));

  const seen = new Set<string>();
  const highlights = rawSegments
    .map(cleanNarrativeSegment)
    .filter((segment) => segment.length >= 18)
    .filter((segment) => {
      const key = segment.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((segment) => trimTextLength(segment, 120))
    .slice(0, 6);

  return highlights.length ? highlights : fallbackHighlights;
};

const createExecutiveSummary = (
  description: string | undefined,
  fallbackText: string,
  highlights: string[],
): string => {
  if (!description) return fallbackText;

  const normalized = normalizeNarrativeText(description);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map(cleanNarrativeSegment)
    .filter(Boolean);

  const summary = trimTextLength(sentences.slice(0, 3).join(' '), 360);
  if (summary.length >= 80) return summary;

  return trimTextLength(highlights.slice(0, 3).join('. '), 320);
};

const classifyYield = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  // Yield classification thresholds representing investment criteria:
  // - 7%+: solid return, strong investment
  // - 5.5-7%: steady return, reliable income
  // - 4.5-5.5%: modest return, acceptable baseline
  // - <4.5%: weak return, below target threshold
  if (value >= 7) return 'solid';
  if (value >= 5.5) return 'steady';
  if (value >= 4.5) return 'modest';
  return 'weak';
};

const classifyRoi = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value >= 15) return 'strong';
  if (value >= 10) return 'attractive';
  if (value >= 7) return 'reasonable';
  return 'limited';
};

const classifyDiscount = (value: number | undefined): string | undefined => {
  if (typeof value !== 'number') return undefined;
  if (value >= 15) return 'notable';
  if (value >= 8) return 'meaningful';
  if (value > 0) return 'slight';
  return undefined;
};

const detectDemandSignal = (highlights: string[], description: string | undefined): string | undefined => {
  const text = `${highlights.join(' ')} ${description ?? ''}`.toLowerCase();
  if (!text.trim()) return undefined;
  if (/(refurb|renovat|moderni[sz]|upgrade)/.test(text)) return 'refurbishment upside';
  if (/(station|transport|commuter|rail|link)/.test(text)) return 'commuter connectivity';
  if (/(tenant demand|rental demand|yield|income)/.test(text)) return 'income-led demand';
  if (/(family|school|garden|house)/.test(text)) return 'practical family appeal';
  if (/(city centre|central|amenit|high street)/.test(text)) return 'everyday amenity access';
  return undefined;
};

const describeOpportunity = (
  investmentType: string,
  propertyType: string,
  bedrooms?: number,
): { opportunity: string; strategy: string } => {
  const investmentKey = investmentType.toLowerCase();
  const propertyKey = propertyType.toLowerCase();
  const familyAppeal =
    typeof bedrooms === 'number' && bedrooms >= 3 && propertyKey.includes('house')
      ? ' with family-house appeal'
      : typeof bedrooms === 'number' && bedrooms <= 2
        ? ' with practical rental appeal'
        : '';

  if (/(brrr|refurb|value add|development)/.test(investmentKey)) {
    return {
      opportunity: `value-add ${investmentType} opportunity${familyAppeal}`,
      strategy: 'a hold-and-refinance angle',
    };
  }

  if (/(flip|resale|sell)/.test(investmentKey)) {
    return {
      opportunity: `refurb-and-exit opportunity${familyAppeal}`,
      strategy: 'a refurb-and-sell path',
    };
  }

  if (/(hmo|multi-let)/.test(investmentKey)) {
    return {
      opportunity: `shared-accommodation income opportunity${familyAppeal}`,
      strategy: 'an income-focused operating plan',
    };
  }

  if (/(buy to let|rental|hold|let)/.test(investmentKey)) {
    return {
      opportunity: `income-oriented ${investmentType} opportunity${familyAppeal}`,
      strategy: 'a hold-for-income profile',
    };
  }

  return {
    opportunity: `${investmentType} opportunity${familyAppeal}`,
    strategy: 'cautious review until the exit path is verified',
  };
};

export const createInvestmentInsight = (input: PropertyPdfExportInput): string => {
  const property = input.property ?? {};
  const location = getText(property.location) ?? 'the stated location';
  const propertyType = getText(property.propertyType ?? property.property_type) ?? 'property';
  const investmentType = getText(property.investmentType ?? property.investment_type) ?? 'investment';
  const bedrooms = toNumber(property.bedrooms);
  const description = getText(property.description);
  const highlights = extractDealHighlights(
    description,
    createFallbackHighlights(location, propertyType, investmentType, bedrooms, toNumber(property.bathrooms)),
  );
  const mergedMetricsSource: Record<string, unknown> = { ...property };
  if (typeof input.price === 'number') mergedMetricsSource.price = input.price;
  if (typeof input.yieldPercent === 'number') mergedMetricsSource.yield_percent = input.yieldPercent;
  if (typeof input.roiPercent === 'number') mergedMetricsSource.roi_percent = input.roiPercent;

  const yieldPercent = getYieldPercent(mergedMetricsSource) ?? undefined;
  const roiPercent = getRoiDisplay(mergedMetricsSource).value ?? undefined;
  const discountPercent =
    typeof input.discountPercent === 'number'
      ? input.discountPercent
      : toNumber(property.discount_percent ?? property.discount_estimate_pct);

  const { opportunity, strategy } = describeOpportunity(investmentType, propertyType, bedrooms);
  const demandSignal = detectDemandSignal(highlights, description);
  const yieldTone = classifyYield(yieldPercent);
  const roiTone = classifyRoi(roiPercent);
  const discountTone = classifyDiscount(discountPercent);

  const insightSentences = [`This appears to be a ${opportunity} in ${location}.`];

  const metricClauses: string[] = [];
  if (yieldTone && typeof yieldPercent === 'number') {
    metricClauses.push(`Yield looks ${yieldTone} at ${yieldPercent.toFixed(1)}%`);
  }
  if (roiTone && typeof roiPercent === 'number') {
    metricClauses.push(`ROI screens as ${roiTone} at ${roiPercent.toFixed(1)}%`);
  }
  if (discountTone && typeof discountPercent === 'number') {
    metricClauses.push(`pricing indicates a ${discountTone} ${discountPercent.toFixed(1)}% discount`);
  }

  if (metricClauses.length) {
    insightSentences.push(`${metricClauses.join(', ')}.`);
  } else {
    insightSentences.push('The current dataset is light, so the numbers should be validated against the live listing before committing to an execution plan.');
  }

  const strategyTail = demandSignal
    ? `with listing signals pointing to ${demandSignal}`
    : 'with the listing still requiring source-level diligence';
  insightSentences.push(`The current profile suggests ${strategy}, ${strategyTail}.`);

  return trimTextLength(insightSentences.join(' '), MAX_INSIGHT_LENGTH);
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

export const getPropertyPdfSections = (input: PropertyPdfExportInput): PropertyPdfSections => {
  const property = input.property ?? {};
  const title = getText(property.title) ?? `Property ${input.propertyId}`;
  const location = getText(property.location) ?? 'Location unavailable';
  const propertyType = getText(property.propertyType ?? property.property_type) ?? 'Property type unavailable';
  const investmentType =
    getText(property.investmentType ?? property.investment_type) ?? 'Investment type unavailable';
  const bedrooms = toNumber(property.bedrooms);
  const bathrooms = toNumber(property.bathrooms);
  const exportedAt = formatDate();
  const sourceUrl = input.url ?? 'Source URL unavailable';

  const price = typeof input.price === 'number' ? input.price : toNumber(property.price);
  const rent = resolveRentMonthly(property);
  const mergedMetricsSource: Record<string, unknown> = {
    ...property,
  };
  if (typeof input.price === 'number') {
    mergedMetricsSource.price = input.price;
  }
  if (typeof input.yieldPercent === 'number') {
    mergedMetricsSource.yield_percent = input.yieldPercent;
  }
  if (typeof input.roiPercent === 'number') {
    mergedMetricsSource.roi_percent = input.roiPercent;
  }
  const derivedYield = getYieldPercent(mergedMetricsSource) ?? undefined;
  const derivedRoi = getRoiDisplay(mergedMetricsSource).value ?? undefined;
  const derivedDiscount =
    typeof input.discountPercent === 'number'
      ? input.discountPercent
      : toNumber(property.discount_percent ?? property.discount_estimate_pct);

  const metrics: ExportMetric[] = [
    { label: 'Price', value: formatCurrency(price) },
    { label: 'Estimated Rent (PCM)', value: formatCurrency(rent) },
    { label: 'Yield', value: formatPercent(derivedYield) },
    { label: 'ROI', value: formatPercent(derivedRoi) },
    { label: 'Discount', value: formatPercent(derivedDiscount) },
    {
      label: 'AI Score',
      value: typeof input.aiScore === 'number' ? `${input.aiScore.toFixed(1)}/10` : 'N/A',
    },
  ];

  const overview: ExportMetric[] = [
    { label: 'Property ID', value: input.propertyId || 'N/A' },
    { label: 'Location', value: location },
    { label: 'Property Type', value: propertyType },
    { label: 'Investment Type', value: investmentType },
    {
      label: 'Bedrooms / Bathrooms',
      value: `${bedrooms ?? 'N/A'} / ${bathrooms ?? 'N/A'}`,
    },
    { label: 'Source URL', value: sourceUrl },
  ];

  const description = getText(property.description);
  const fallbackNotes = createEmptyNotesState(property);
  const highlights = extractDealHighlights(
    description,
    createFallbackHighlights(location, propertyType, investmentType, bedrooms, bathrooms),
  );
  const notes = createExecutiveSummary(description, fallbackNotes, highlights);
  const investmentInsight = createInvestmentInsight(input);

  return {
    brandTitle: 'PropNexus',
    reportTitle: 'Investor Deal Pack',
    reportSubtitle: 'Investor-ready property brief prepared from the live PropNexus listing.',
    title,
    location,
    titleMeta: [
      { label: 'Property Type', value: propertyType },
      { label: 'Bedrooms / Bathrooms', value: `${bedrooms ?? 'N/A'} / ${bathrooms ?? 'N/A'}` },
      { label: 'Investment Type', value: investmentType },
    ],
    metrics,
    highlights,
    investmentInsight,
    overview,
    notes,
    hasNarrativeDescription: Boolean(description),
    exportedAt,
    sourceUrl,
    imageUrl: resolvePrimaryImageUrl(property),
  };
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  marginY: 52,
};

const COLORS = {
  brand: rgb(14 / 255, 116 / 255, 144 / 255),
  brandDark: rgb(15 / 255, 23 / 255, 42 / 255),
  accent: rgb(56 / 255, 189 / 255, 248 / 255),
  accentSoft: rgb(236 / 255, 254 / 255, 255 / 255),
  accentStrong: rgb(8 / 255, 145 / 255, 178 / 255),
  highlightFill: rgb(241 / 255, 245 / 255, 249 / 255),
  text: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(71 / 255, 85 / 255, 105 / 255),
  mutedSoft: rgb(148 / 255, 163 / 255, 184 / 255),
  border: rgb(226 / 255, 232 / 255, 240 / 255),
  sectionFill: rgb(248 / 255, 250 / 255, 252 / 255),
  panelFill: rgb(255 / 255, 255 / 255, 255 / 255),
};

const HERO_IMAGE = {
  height: 124,
  footerHeight: 58,
};

const CONTENT_BOTTOM_Y = PAGE.marginY + 24;

const SECTION_SPACING = {
  titleBottom: 12,
  metricsTop: 2,
  metricsBottom: 2,
  overviewBottom: 8,
  notesBottom: 12,
};

type PdfState = {
  page: PDFPage;
  cursorY: number;
};

const wrapPdfText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const source = text.replace(/\r/g, '');
  const paragraphs = source.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) {
        lines.push(line);
        line = word;
        continue;
      }

      let remainder = word;
      while (remainder) {
        let sliceLength = remainder.length;
        while (
          sliceLength > 1 &&
          font.widthOfTextAtSize(remainder.slice(0, sliceLength), size) > maxWidth
        ) {
          sliceLength -= 1;
        }
        lines.push(remainder.slice(0, sliceLength));
        remainder = remainder.slice(sliceLength);
      }
      line = '';
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : [''];
};

const addPdfPage = (pdfDoc: PDFDocument): PdfState => ({
  page: pdfDoc.addPage([PAGE.width, PAGE.height]),
  cursorY: PAGE.height - PAGE.marginY,
});

const ensurePdfSpace = (
  pdfDoc: PDFDocument,
  state: PdfState,
  heightNeeded: number,
): PdfState => {
  if (state.cursorY - heightNeeded >= CONTENT_BOTTOM_Y) return state;
  return addPdfPage(pdfDoc);
};

const getAvailableContentHeight = (state: PdfState): number => {
  return Math.max(0, state.cursorY - CONTENT_BOTTOM_Y);
};

const ellipsizeToWidth = (text: string, font: PDFFont, size: number, maxWidth: number): string => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}…`;
};

const wrapPdfTextLines = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines?: number,
): string[] => {
  const lines = wrapPdfText(text, font, size, maxWidth);
  if (!maxLines || lines.length <= maxLines) return lines;
  const limited = lines.slice(0, maxLines);
  limited[maxLines - 1] = ellipsizeToWidth(limited[maxLines - 1], font, size, maxWidth);
  return limited;
};

const drawPdfLine = (
  state: PdfState,
  text: string,
  options: {
    font: PDFFont;
    size: number;
    x: number;
    color?: ReturnType<typeof rgb>;
  },
): PdfState => {
  const { font, size, x, color = COLORS.text } = options;
  if (text) {
    state.page.drawText(text, {
      x,
      y: state.cursorY,
      size,
      font,
      color,
    });
  }
  return { ...state, cursorY: state.cursorY - size - 4 };
};

const drawPdfSection = (
  pdfDoc: PDFDocument,
  state: PdfState,
  title: string,
  items: ExportMetric[],
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  let next = ensurePdfSpace(pdfDoc, state, 40 + items.length * 20);

  const boxTop = next.cursorY + 10;
  const boxWidth = PAGE.width - PAGE.marginX * 2;
  const headerHeight = 24;
  const bodyHeight = Math.max(28, items.length * 20 + 12);

  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight,
    width: boxWidth,
    height: headerHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.sectionFill,
  });
  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight - bodyHeight,
    width: boxWidth,
    height: bodyHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawText(title, {
    x: PAGE.marginX + 12,
    y: boxTop - 16,
    size: 11,
    font: boldFont,
    color: COLORS.text,
  });

  next = { ...next, cursorY: boxTop - headerHeight - 18 };
  for (const item of items) {
    next = ensurePdfSpace(pdfDoc, next, 20);
    next.page.drawText(item.label, {
      x: PAGE.marginX + 12,
      y: next.cursorY,
      size: 10,
      font: regularFont,
      color: COLORS.muted,
    });

    const value = item.value || 'N/A';
    const textWidth = boldFont.widthOfTextAtSize(value, 10);
    next.page.drawText(value, {
      x: PAGE.width - PAGE.marginX - 12 - textWidth,
      y: next.cursorY,
      size: 10,
      font: boldFont,
      color: COLORS.text,
    });
    next = { ...next, cursorY: next.cursorY - 18 };
  }

  return { ...next, cursorY: next.cursorY - 12 };
};

const drawMetricCards = (
  pdfDoc: PDFDocument,
  state: PdfState,
  metrics: ExportMetric[],
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  let next = ensurePdfSpace(pdfDoc, state, 126);
  next.page.drawText('Deal Snapshot', {
    x: PAGE.marginX,
    y: next.cursorY,
    size: 14,
    font: boldFont,
    color: COLORS.brandDark,
  });
  next.page.drawText('Investment highlights arranged for a fast first read.', {
    x: PAGE.marginX,
    y: next.cursorY - 14,
    size: 8.5,
    font: regularFont,
    color: COLORS.muted,
  });
  next = { ...next, cursorY: next.cursorY - 24 };

  const columns = 3;
  const gap = 7;
  const cardWidth = (PAGE.width - PAGE.marginX * 2 - gap * (columns - 1)) / columns;
  const cardHeight = 46;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = PAGE.marginX + column * (cardWidth + gap);
    const y = next.cursorY - row * (cardHeight + gap);
    const featured = ['Yield', 'ROI', 'Discount'].includes(metric.label) && metric.value !== 'N/A';

    next.page.drawRectangle({
      x,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: featured ? COLORS.accentSoft : COLORS.panelFill,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    next.page.drawRectangle({
      x,
      y: y - 6,
      width: cardWidth,
      height: 6,
      color: featured ? COLORS.accentStrong : index % 2 === 0 ? COLORS.brand : COLORS.accent,
    });
    next.page.drawText(metric.label, {
      x: x + 12,
      y: y - 18,
      size: 7.5,
      font: regularFont,
      color: COLORS.muted,
    });
    next.page.drawText(metric.value || 'N/A', {
      x: x + 12,
      y: y - 39,
      size: featured ? 18 : 16,
      font: boldFont,
      color: COLORS.brandDark,
    });
  });

  const rows = Math.ceil(metrics.length / columns);
  return {
    ...next,
    cursorY: next.cursorY - rows * (cardHeight + gap) + SECTION_SPACING.metricsBottom,
  };
};

const drawHighlightsSection = (
  pdfDoc: PDFDocument,
  state: PdfState,
  highlights: string[],
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  const contentWidth = PAGE.width - PAGE.marginX * 2 - 30;
  const bulletLayouts = highlights.map((highlight) =>
    wrapPdfTextLines(highlight, regularFont, 9, contentWidth - 16, 2),
  );
  const bodyHeight = Math.max(
    42,
    bulletLayouts.reduce((total, lines) => total + lines.length * 9 + 5, 12),
  );

  let next = ensurePdfSpace(pdfDoc, state, bodyHeight + 46);
  const boxTop = next.cursorY + 6;
  const boxWidth = PAGE.width - PAGE.marginX * 2;
  const headerHeight = 24;

  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight,
    width: boxWidth,
    height: headerHeight,
    color: COLORS.sectionFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight - bodyHeight,
    width: boxWidth,
    height: bodyHeight,
    color: COLORS.panelFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawText('Deal Highlights', {
    x: PAGE.marginX + 12,
    y: boxTop - 16,
    size: 12,
    font: boldFont,
    color: COLORS.brandDark,
  });
  next.page.drawText('Curated signals from the listing and core deal data.', {
    x: PAGE.marginX + 118,
    y: boxTop - 16,
    size: 8,
    font: regularFont,
    color: COLORS.muted,
  });

  let bulletY = boxTop - headerHeight - 12;
  bulletLayouts.forEach((lines, index) => {
    next.page.drawRectangle({
      x: PAGE.marginX + 13,
      y: bulletY - 5,
      width: 12,
      height: 12,
      color: COLORS.accentSoft,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    next.page.drawText(String(index + 1), {
      x: PAGE.marginX + 16.5,
      y: bulletY,
      size: 8,
      font: boldFont,
      color: COLORS.brand,
    });
    lines.forEach((line, lineIndex) => {
      next.page.drawText(line, {
        x: PAGE.marginX + 28,
        y: bulletY - lineIndex * 9,
        size: 9,
        font: regularFont,
        color: COLORS.text,
      });
    });
    bulletY -= lines.length * 9 + 5;
  });

  return {
    ...next,
    cursorY: boxTop - headerHeight - bodyHeight - 10,
  };
};

const drawInvestmentInsightSection = (
  pdfDoc: PDFDocument,
  state: PdfState,
  investmentInsight: string,
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  const lines = wrapPdfTextLines(
    investmentInsight,
    regularFont,
    9,
    PAGE.width - PAGE.marginX * 2 - 28,
    3,
  );
  const headerHeight = 24;
  const bodyHeight = Math.max(34, lines.length * 9 + 10);
  let next = ensurePdfSpace(pdfDoc, state, headerHeight + bodyHeight + 14);
  const boxTop = next.cursorY + 6;
  const boxWidth = PAGE.width - PAGE.marginX * 2;

  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight,
    width: boxWidth,
    height: headerHeight,
    color: COLORS.brandDark,
  });
  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight - bodyHeight,
    width: boxWidth,
    height: bodyHeight,
    color: COLORS.accentSoft,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawText('Investment Insight', {
    x: PAGE.marginX + 12,
    y: boxTop - 16,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  let textY = boxTop - headerHeight - 12;
  lines.forEach((line) => {
    next.page.drawText(line, {
      x: PAGE.marginX + 12,
      y: textY,
      size: 9,
      font: regularFont,
      color: COLORS.text,
    });
    textY -= 9;
  });

  return {
    ...next,
    cursorY: boxTop - headerHeight - bodyHeight - 10,
  };
};

const drawOverviewGrid = (
  pdfDoc: PDFDocument,
  state: PdfState,
  items: ExportMetric[],
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  let next = ensurePdfSpace(pdfDoc, state, 118);
  const boxTop = next.cursorY + 6;
  const boxWidth = PAGE.width - PAGE.marginX * 2;
  const headerHeight = 22;
  const rowHeight = 20;
  const rows = Math.ceil(items.length / 2);
  const bodyHeight = rows * rowHeight + 8;
  const leftX = PAGE.marginX + 14;
  const rightX = PAGE.marginX + boxWidth / 2 + 12;
  const columnWidth = boxWidth / 2 - 28;

  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight,
    width: boxWidth,
    height: headerHeight,
    color: COLORS.sectionFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - headerHeight - bodyHeight,
    width: boxWidth,
    height: bodyHeight,
    color: COLORS.panelFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  next.page.drawText('Asset Overview', {
    x: PAGE.marginX + 12,
    y: boxTop - 17,
    size: 12,
    font: boldFont,
    color: COLORS.brandDark,
  });

  items.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const isRight = index % 2 === 1;
    const baseX = isRight ? rightX : leftX;
    const topY = boxTop - headerHeight - 11 - row * rowHeight;
    next.page.drawText(item.label, {
      x: baseX,
      y: topY,
      size: 7.5,
      font: regularFont,
      color: COLORS.muted,
    });
    const valueLines =
      item.label === 'Source URL'
        ? wrapPdfTextLines(item.value || 'N/A', regularFont, 9, columnWidth, 2)
        : wrapPdfTextLines(item.value || 'N/A', regularFont, 9.5, columnWidth, 2);
    valueLines.forEach((line, lineIndex) => {
      next.page.drawText(line, {
        x: baseX,
        y: topY - 9 - lineIndex * 8,
        size: item.label === 'Source URL' ? 9 : 9.5,
        font: lineIndex === 0 ? boldFont : regularFont,
        color: COLORS.text,
      });
    });
  });

  return {
    ...next,
    cursorY: boxTop - headerHeight - bodyHeight - SECTION_SPACING.overviewBottom,
  };
};

type NotesLayout = {
  title: string;
  lines: string[];
  bodyHeight: number;
  headerHeight: number;
  lineHeight: number;
  fontSize: number;
  compact: boolean;
};

const buildNotesLayout = (
  notes: string,
  hasNarrativeDescription: boolean,
  regularFont: PDFFont,
): NotesLayout => {
  const compact = !hasNarrativeDescription;
  const fontSize = compact ? 9 : 9.75;
  const lineHeight = compact ? 11 : 12.75;
  const headerHeight = compact ? 22 : 24;
  const title = compact ? 'Summary Snapshot' : 'Executive Summary';
  const lines = compact
    ? wrapPdfTextLines(notes, regularFont, fontSize, PAGE.width - PAGE.marginX * 2 - 24, 2)
    : wrapPdfText(notes, regularFont, fontSize, PAGE.width - PAGE.marginX * 2 - 24);
  const minBodyHeight = compact ? 28 : 38;
  const padding = compact ? 8 : 12;

  return {
    title,
    lines,
    bodyHeight: Math.max(minBodyHeight, lines.length * lineHeight + padding),
    headerHeight,
    lineHeight,
    fontSize,
    compact,
  };
};

const getNotesSectionHeight = (layout: NotesLayout): number => {
  return layout.headerHeight + layout.bodyHeight + SECTION_SPACING.notesBottom;
};

const getNotesLinesPerPage = (availableHeight: number, layout: NotesLayout): number => {
  const usableBodyHeight = Math.max(0, availableHeight - layout.headerHeight - SECTION_SPACING.notesBottom);
  return Math.max(0, Math.floor((usableBodyHeight - 12) / layout.lineHeight));
};

const drawNotesBlock = (
  state: PdfState,
  layout: NotesLayout,
  lines: string[],
  regularFont: PDFFont,
  boldFont: PDFFont,
  title: string,
): PdfState => {
  const boxTop = state.cursorY + 8;

  state.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - layout.headerHeight,
    width: PAGE.width - PAGE.marginX * 2,
    height: layout.headerHeight,
    color: COLORS.sectionFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  state.page.drawRectangle({
    x: PAGE.marginX,
    y: boxTop - layout.headerHeight - layout.bodyHeight,
    width: PAGE.width - PAGE.marginX * 2,
    height: layout.bodyHeight,
    color: COLORS.panelFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  state.page.drawText(title, {
    x: PAGE.marginX + 12,
    y: boxTop - 17,
    size: 12,
    font: boldFont,
    color: COLORS.brandDark,
  });

  let textY = boxTop - layout.headerHeight - (layout.compact ? 12 : 15);
  lines.forEach((line) => {
    if (line) {
      state.page.drawText(line, {
        x: PAGE.marginX + 12,
        y: textY,
        size: layout.fontSize,
        font: regularFont,
        color: COLORS.text,
      });
    }
    textY -= layout.lineHeight;
  });

  return {
    ...state,
    cursorY: boxTop - layout.headerHeight - layout.bodyHeight - SECTION_SPACING.notesBottom,
  };
};

const drawNotesSection = (
  pdfDoc: PDFDocument,
  state: PdfState,
  notes: string,
  hasNarrativeDescription: boolean,
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  const layout = buildNotesLayout(notes, hasNarrativeDescription, regularFont);
  const totalHeight = getNotesSectionHeight(layout);
  let next = state;

  if (getAvailableContentHeight(next) >= totalHeight) {
    return drawNotesBlock(next, layout, layout.lines, regularFont, boldFont, layout.title);
  }

  next = addPdfPage(pdfDoc);

  if (getAvailableContentHeight(next) >= totalHeight) {
    return drawNotesBlock(next, layout, layout.lines, regularFont, boldFont, layout.title);
  }

  let offset = 0;
  let title = layout.title;
  while (offset < layout.lines.length) {
    const availableHeight = getAvailableContentHeight(next);
    const linesPerPage = Math.max(4, getNotesLinesPerPage(availableHeight, layout));
    const slice = layout.lines.slice(offset, offset + linesPerPage);
    const sliceLayout: NotesLayout = {
      ...layout,
      bodyHeight: Math.max(
        layout.compact ? 34 : 52,
        slice.length * layout.lineHeight + (layout.compact ? 12 : 18),
      ),
    };
    next = drawNotesBlock(next, sliceLayout, slice, regularFont, boldFont, title);
    offset += slice.length;
    if (offset < layout.lines.length) {
      next = addPdfPage(pdfDoc);
      title = `${layout.title} (continued)`;
    }
  }

  return next;
};

const drawFooter = (
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  sections: PropertyPdfSections,
  pageIndex: number,
  totalPages: number,
): void => {
  const y = PAGE.marginY - 12;
  page.drawLine({
    start: { x: PAGE.marginX, y: y + 18 },
    end: { x: PAGE.width - PAGE.marginX, y: y + 18 },
    thickness: 1,
    color: COLORS.border,
  });
  page.drawText(sections.brandTitle, {
    x: PAGE.marginX,
    y: y + 2,
    size: 9,
    font: boldFont,
    color: COLORS.brand,
  });
  page.drawText(ellipsizeToWidth(sections.sourceUrl, regularFont, 8.5, 220), {
    x: PAGE.marginX + 58,
    y: y + 2,
    size: 8.5,
    font: regularFont,
    color: COLORS.muted,
  });
  const rightText = `${sections.exportedAt}  |  Page ${pageIndex + 1} of ${totalPages}`;
  const rightWidth = regularFont.widthOfTextAtSize(rightText, 8.5);
  page.drawText(rightText, {
    x: PAGE.width - PAGE.marginX - rightWidth,
    y: y + 2,
    size: 8.5,
    font: regularFont,
    color: COLORS.muted,
  });
};

const drawHeaderBand = (
  page: PDFPage,
  sections: PropertyPdfSections,
  regularFont: PDFFont,
  boldFont: PDFFont,
): number => {
  const top = PAGE.height - 26;
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 92,
    width: PAGE.width,
    height: 92,
    color: COLORS.brandDark,
  });
  page.drawRectangle({
    x: PAGE.marginX,
    y: PAGE.height - 78,
    width: 92,
    height: 4,
    color: COLORS.accent,
  });
  page.drawText(sections.brandTitle, {
    x: PAGE.marginX,
    y: top - 18,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(sections.reportTitle, {
    x: PAGE.marginX,
    y: top - 42,
    size: 24,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(sections.reportSubtitle, {
    x: PAGE.marginX,
    y: top - 58,
    size: 10,
    font: regularFont,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });
  const timestamp = `Exported ${sections.exportedAt}`;
  const width = regularFont.widthOfTextAtSize(timestamp, 9);
  page.drawText(timestamp, {
    x: PAGE.width - PAGE.marginX - width,
    y: top - 18,
    size: 9,
    font: regularFont,
    color: rgb(226 / 255, 232 / 255, 240 / 255),
  });
  return PAGE.height - 112;
};

const resolveImageFormat = (
  url: string,
  contentType?: string | null,
  bytes?: Uint8Array,
): 'png' | 'jpg' | null => {
  const type = (contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (bytes && bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (isPng) return 'png';
  }
  if (bytes && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('.png')) return 'png';
  if (normalizedUrl.includes('.jpg') || normalizedUrl.includes('.jpeg')) return 'jpg';
  return null;
};

const buildPropertyImageFetchTargets = (imageUrl: string): string[] => {
  const direct = getText(imageUrl);
  if (!direct) return [];
  
  // Defensive check: This function is intended for client use, but includes a check for server environments
  if (typeof window === 'undefined') {
    console.warn('buildPropertyImageFetchTargets called in server environment');
    return [];
  }

  try {
    const absolute = new URL(direct, window.location.origin);
    if (isUnsafePdfImageUrl(absolute, window.location.origin)) {
      return [];
    }

    if (absolute.origin === window.location.origin) {
      return [absolute.toString()];
    }

    const proxyPath = buildPdfImageProxyPath(absolute.toString());
    return proxyPath ? [proxyPath, absolute.toString()] : [absolute.toString()];
  } catch {
    return [];
  }
};

const loadPropertyImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string,
): Promise<PDFImage | null> => {
  if (!imageUrl) return null;

  for (const target of buildPropertyImageFetchTargets(imageUrl)) {
    try {
      const response = await fetch(target, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
      });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const format = resolveImageFormat(response.url || target, response.headers.get('content-type'), bytes);
      if (!format) continue;
      return format === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    } catch {
      continue;
    }
  }

  return null;
};

const drawTitleBlock = (
  page: PDFPage,
  sections: PropertyPdfSections,
  regularFont: PDFFont,
  boldFont: PDFFont,
  image: PDFImage | null,
  startY: number,
): number => {
  const boxHeight = HERO_IMAGE.height + HERO_IMAGE.footerHeight;
  const boxY = startY - boxHeight;
  const boxWidth = PAGE.width - PAGE.marginX * 2;
  page.drawRectangle({
    x: PAGE.marginX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: COLORS.panelFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  const heroTop = boxY + boxHeight;
  const heroY = heroTop - HERO_IMAGE.height;

  page.drawRectangle({
    x: PAGE.marginX,
    y: heroY,
    width: boxWidth,
    height: HERO_IMAGE.height,
    color: image ? COLORS.highlightFill : COLORS.sectionFill,
  });

  if (image) {
    // Cover scaling uses Math.max to fill the hero area fully, which means the image
    // will be cropped to fit. This creates a photographic feel rather than letterboxing.
    // Tradeoff: Important image content may be cut off at the edges. This is acceptable
    // for property photos where the focal point is typically centered. If this becomes
    // an issue for specific use cases, consider making it configurable per property type.
    const imageScale = Math.max(boxWidth / image.width, HERO_IMAGE.height / image.height);
    const imageWidth = image.width * imageScale;
    const imageHeight = image.height * imageScale;
    const imageX = PAGE.marginX + (boxWidth - imageWidth) / 2;
    const imageY = heroY + (HERO_IMAGE.height - imageHeight) / 2;
    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    });
    page.drawRectangle({
      x: PAGE.marginX,
      y: heroY,
      width: boxWidth,
      height: HERO_IMAGE.height,
      color: COLORS.brandDark,
      opacity: 0.16,
    });
    const pillLabel = 'Featured Listing';
    const pillWidth = regularFont.widthOfTextAtSize(pillLabel, 8.5) + 20;
    page.drawRectangle({
      x: PAGE.marginX + 18,
      y: heroY + HERO_IMAGE.height - 24,
      width: pillWidth,
      height: 16,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });
    page.drawText(pillLabel, {
      x: PAGE.marginX + 28,
      y: heroY + HERO_IMAGE.height - 19,
      size: 8.5,
      font: boldFont,
      color: COLORS.brandDark,
    });
  } else {
    page.drawRectangle({
      x: PAGE.marginX,
      y: heroY,
      width: boxWidth,
      height: HERO_IMAGE.height,
      color: COLORS.brandDark,
    });
    page.drawRectangle({
      x: PAGE.marginX + 20,
      y: heroY + HERO_IMAGE.height - 40,
      width: boxWidth - 40,
      height: 2,
      color: COLORS.accentStrong,
    });
    page.drawRectangle({
      x: PAGE.marginX + 20,
      y: heroY + 18,
      width: boxWidth - 40,
      height: HERO_IMAGE.height - 76,
      color: COLORS.brand,
      opacity: 0.18,
    });
    page.drawText('Listing image unavailable at export time', {
      x: PAGE.marginX + 22,
      y: heroY + 74,
      size: 12,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    page.drawText('Key investment signals and deal context remain available below.', {
      x: PAGE.marginX + 22,
      y: heroY + 56,
      size: 10,
      font: regularFont,
      color: rgb(226 / 255, 232 / 255, 240 / 255),
    });
  }

  const footerY = boxY;
  page.drawRectangle({
    x: PAGE.marginX,
    y: footerY,
    width: boxWidth,
    height: HERO_IMAGE.footerHeight,
    color: COLORS.panelFill,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: PAGE.marginX,
    y: footerY + HERO_IMAGE.footerHeight - 4,
    width: boxWidth,
    height: 4,
    color: COLORS.brand,
  });

  const textX = PAGE.marginX + 18;
  const textWidth = boxWidth - 36;
  const titleLines = wrapPdfTextLines(sections.title, boldFont, 18, textWidth, 2);
  let cursorY = footerY + HERO_IMAGE.footerHeight - 16;
  titleLines.forEach((line, index) => {
    page.drawText(line, {
      x: textX,
      y: cursorY - index * 16,
      size: 18,
      font: boldFont,
      color: COLORS.brandDark,
    });
  });
  cursorY -= titleLines.length * 16 + 2;

  const locationLines = wrapPdfTextLines(sections.location, regularFont, 10, textWidth, 2);
  locationLines.forEach((line, index) => {
    page.drawText(line, {
      x: textX,
      y: cursorY - index * 11,
      size: 10,
      font: regularFont,
      color: COLORS.muted,
    });
  });
  cursorY -= locationLines.length * 11 + 5;

  const chipHeight = 16;
  const chipGap = 5;
  let chipX = textX;
  let chipY = cursorY;
  sections.titleMeta.forEach((item) => {
    const label = `${item.label}: ${item.value}`;
    const chipWidth = Math.min(
      textWidth,
      regularFont.widthOfTextAtSize(label, 9) + 20,
    );
    if (chipX + chipWidth > textX + textWidth) {
      chipX = textX;
      chipY -= chipHeight + 6;
    }
    page.drawRectangle({
      x: chipX,
      y: chipY - chipHeight + 3,
      width: chipWidth,
      height: chipHeight,
      color: COLORS.highlightFill,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText(ellipsizeToWidth(label, regularFont, 9, chipWidth - 12), {
      x: chipX + 6,
      y: chipY - 9,
      size: 8,
      font: regularFont,
      color: COLORS.brandDark,
    });
    chipX += chipWidth + chipGap;
  });

  return boxY - SECTION_SPACING.titleBottom;
};

const triggerPdfDownload = (filename: string, bytes: Uint8Array): void => {
  const blobBytes = Uint8Array.from(bytes);
  const blob = new Blob([blobBytes], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export async function exportPropertyPdf(input: PropertyPdfExportInput): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF export is only available in the browser.');
  }

  const sections = getPropertyPdfSections(input);
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let state = addPdfPage(pdfDoc);

  const image = await loadPropertyImage(pdfDoc, sections.imageUrl);
  state = { ...state, cursorY: drawHeaderBand(state.page, sections, regularFont, boldFont) };
  state = {
    ...state,
    cursorY: drawTitleBlock(state.page, sections, regularFont, boldFont, image, state.cursorY),
  };
  state = { ...state, cursorY: state.cursorY + SECTION_SPACING.metricsTop };
  state = drawMetricCards(pdfDoc, state, sections.metrics, regularFont, boldFont);
  state = drawHighlightsSection(pdfDoc, state, sections.highlights, regularFont, boldFont);
  state = drawInvestmentInsightSection(
    pdfDoc,
    state,
    sections.investmentInsight,
    regularFont,
    boldFont,
  );
  state = drawOverviewGrid(pdfDoc, state, sections.overview, regularFont, boldFont);
  state = drawNotesSection(
    pdfDoc,
    state,
    sections.notes,
    sections.hasNarrativeDescription,
    regularFont,
    boldFont,
  );

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    drawFooter(page, regularFont, boldFont, sections, index, pages.length);
  });

  const bytes = await pdfDoc.save();
  triggerPdfDownload(createPropertyPdfFilename(input), bytes);
}
