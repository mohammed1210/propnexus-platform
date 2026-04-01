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

const resolvePrimaryImageUrl = (property: Record<string, unknown>): string | undefined => {
  const direct = [
    property.imageUrl,
    property.image_url,
    property.imageurl,
    property.thumbnail,
    property.cover_photo_url,
  ];

  for (const candidate of direct) {
    const url = getText(candidate);
    if (url) return url;
  }

  const collections = [property.image_urls, property.imageUrls, property.images, property.photos];
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const candidate of collection) {
      const url = getText(candidate);
      if (url) return url;
    }
  }

  return undefined;
};

const createEmptyNotesState = (property: Record<string, unknown>): string => {
  const title = getText(property.title) ?? 'This property';
  return `${title} does not currently include a narrative description. This report still captures the core investment metrics, property overview, and source link for review.`;
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

  const metrics: ExportMetric[] = [
    { label: 'Price', value: formatCurrency(price) },
    { label: 'Estimated Rent (PCM)', value: formatCurrency(rent) },
    { label: 'Yield', value: formatPercent(derivedYield) },
    { label: 'ROI', value: formatPercent(derivedRoi) },
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
    { label: 'Property Type', value: propertyType },
    { label: 'Investment Type', value: investmentType },
    {
      label: 'Bedrooms / Bathrooms',
      value: `${bedrooms ?? 'N/A'} / ${bathrooms ?? 'N/A'}`,
    },
    { label: 'Exported At', value: exportedAt },
    { label: 'Source URL', value: sourceUrl },
  ];

  const description = getText(property.description);
  const notes = description ?? createEmptyNotesState(property);

  return {
    brandTitle: 'PropNexus',
    reportTitle: 'Property Deal Export',
    reportSubtitle: 'Investor-facing summary prepared from the live property detail view.',
    title,
    location,
    titleMeta: [
      { label: 'Property Type', value: propertyType },
      { label: 'Bedrooms / Bathrooms', value: `${bedrooms ?? 'N/A'} / ${bathrooms ?? 'N/A'}` },
      { label: 'Investment Type', value: investmentType },
    ],
    metrics,
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
  text: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(71 / 255, 85 / 255, 105 / 255),
  mutedSoft: rgb(148 / 255, 163 / 255, 184 / 255),
  border: rgb(226 / 255, 232 / 255, 240 / 255),
  sectionFill: rgb(248 / 255, 250 / 255, 252 / 255),
  panelFill: rgb(255 / 255, 255 / 255, 255 / 255),
};

const IMAGE_BOX = {
  width: 212,
  height: 146,
};

const CONTENT_BOTTOM_Y = PAGE.marginY + 34;

const SECTION_SPACING = {
  titleBottom: 14,
  metricsTop: 2,
  metricsBottom: 2,
  overviewBottom: 10,
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
  let next = ensurePdfSpace(pdfDoc, state, 170);
  next.page.drawText('Key Investment Metrics', {
    x: PAGE.marginX,
    y: next.cursorY,
    size: 13,
    font: boldFont,
    color: COLORS.brandDark,
  });
  next = { ...next, cursorY: next.cursorY - 20 };

  const columns = 3;
  const gap = 12;
  const cardWidth = (PAGE.width - PAGE.marginX * 2 - gap * (columns - 1)) / columns;
  const cardHeight = 64;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = PAGE.marginX + column * (cardWidth + gap);
    const y = next.cursorY - row * (cardHeight + gap);

    next.page.drawRectangle({
      x,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: COLORS.panelFill,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    next.page.drawRectangle({
      x,
      y: y - 5,
      width: cardWidth,
      height: 5,
      color: index === 5 ? COLORS.accent : COLORS.brand,
    });
    next.page.drawText(metric.label, {
      x: x + 12,
      y: y - 21,
      size: 9,
      font: regularFont,
      color: COLORS.muted,
    });
    next.page.drawText(metric.value || 'N/A', {
      x: x + 12,
      y: y - 43,
      size: 18,
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

const drawOverviewGrid = (
  pdfDoc: PDFDocument,
  state: PdfState,
  items: ExportMetric[],
  regularFont: PDFFont,
  boldFont: PDFFont,
): PdfState => {
  let next = ensurePdfSpace(pdfDoc, state, 170);
  const boxTop = next.cursorY + 8;
  const boxWidth = PAGE.width - PAGE.marginX * 2;
  const headerHeight = 24;
  const rowHeight = 24;
  const rows = Math.ceil(items.length / 2);
  const bodyHeight = rows * rowHeight + 14;
  const leftX = PAGE.marginX + 14;
  const rightX = PAGE.marginX + boxWidth / 2 + 10;
  const columnWidth = boxWidth / 2 - 24;

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
  next.page.drawText('Property Overview', {
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
    const topY = boxTop - headerHeight - 16 - row * rowHeight;
    next.page.drawText(item.label, {
      x: baseX,
      y: topY,
      size: 8,
      font: regularFont,
      color: COLORS.muted,
    });
    const valueLines = wrapPdfTextLines(item.value || 'N/A', regularFont, 10, columnWidth, 2);
    valueLines.forEach((line, lineIndex) => {
      next.page.drawText(line, {
        x: baseX,
        y: topY - 11 - lineIndex * 10,
        size: 10,
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
  const fontSize = compact ? 10 : 10.5;
  const lineHeight = compact ? 13 : 15;
  const headerHeight = compact ? 24 : 26;
  const title = compact ? 'Summary Snapshot' : 'Executive Summary';
  const lines = wrapPdfText(notes, regularFont, fontSize, PAGE.width - PAGE.marginX * 2 - 24);
  const minBodyHeight = compact ? 34 : 52;
  const padding = compact ? 12 : 18;

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

  let textY = boxTop - layout.headerHeight - (layout.compact ? 14 : 18);
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
    y: PAGE.height - 96,
    width: PAGE.width,
    height: 96,
    color: COLORS.brandDark,
  });
  page.drawRectangle({
    x: PAGE.marginX,
    y: PAGE.height - 82,
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
    size: 10.5,
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
  return PAGE.height - 122;
};

const resolveImageFormat = (url: string, contentType?: string | null): 'png' | 'jpg' | null => {
  const type = (contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('.png')) return 'png';
  if (normalizedUrl.includes('.jpg') || normalizedUrl.includes('.jpeg')) return 'jpg';
  return null;
};

const loadPropertyImage = async (
  pdfDoc: PDFDocument,
  imageUrl?: string,
): Promise<PDFImage | null> => {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const format = resolveImageFormat(imageUrl, response.headers.get('content-type'));
    if (!format) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return format === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
};

const drawTitleBlock = (
  page: PDFPage,
  sections: PropertyPdfSections,
  regularFont: PDFFont,
  boldFont: PDFFont,
  image: PDFImage | null,
  startY: number,
): number => {
  const boxY = startY - 168;
  const boxHeight = 168;
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

  let textX = PAGE.marginX + 18;
  let textWidth = boxWidth - 36;

  if (image) {
    const imageScale = Math.min(IMAGE_BOX.width / image.width, IMAGE_BOX.height / image.height);
    const imageWidth = image.width * imageScale;
    const imageHeight = image.height * imageScale;
    const imageX = PAGE.marginX + 18 + (IMAGE_BOX.width - imageWidth) / 2;
    const imageY = boxY + boxHeight - 18 - IMAGE_BOX.height + (IMAGE_BOX.height - imageHeight) / 2;

    page.drawRectangle({
      x: PAGE.marginX + 18,
      y: boxY + boxHeight - 18 - IMAGE_BOX.height,
      width: IMAGE_BOX.width,
      height: IMAGE_BOX.height,
      color: COLORS.sectionFill,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawImage(image, {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
    });

    textX = PAGE.marginX + 18 + IMAGE_BOX.width + 18;
    textWidth = boxWidth - IMAGE_BOX.width - 54;
  }

  const titleLines = wrapPdfTextLines(sections.title, boldFont, 21, textWidth, 2);
  let cursorY = boxY + boxHeight - 28;
  titleLines.forEach((line, index) => {
    page.drawText(line, {
      x: textX,
      y: cursorY - index * 22,
      size: 21,
      font: boldFont,
      color: COLORS.brandDark,
    });
  });
  cursorY -= titleLines.length * 22 + 4;

  const locationLines = wrapPdfTextLines(sections.location, regularFont, 12, textWidth, 2);
  locationLines.forEach((line, index) => {
    page.drawText(line, {
      x: textX,
      y: cursorY - index * 14,
      size: 12,
      font: regularFont,
      color: COLORS.muted,
    });
  });
  cursorY -= locationLines.length * 14 + 10;

  const chipHeight = 22;
  const chipGap = 6;
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
      color: COLORS.accentSoft,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText(ellipsizeToWidth(label, regularFont, 9, chipWidth - 12), {
      x: chipX + 6,
      y: chipY - 11,
      size: 9,
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
