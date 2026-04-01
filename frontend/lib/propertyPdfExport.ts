'use client';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
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

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  marginY: 52,
};

const COLORS = {
  text: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(71 / 255, 85 / 255, 105 / 255),
  border: rgb(226 / 255, 232 / 255, 240 / 255),
  sectionFill: rgb(248 / 255, 250 / 255, 252 / 255),
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
  if (state.cursorY - heightNeeded >= PAGE.marginY) return state;
  return addPdfPage(pdfDoc);
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

  state.page.drawText(sections.heading, {
    x: PAGE.marginX,
    y: state.cursorY,
    size: 20,
    font: boldFont,
    color: COLORS.text,
  });
  state = { ...state, cursorY: state.cursorY - 30 };

  state = drawPdfLine(state, sections.subtitle, {
    font: regularFont,
    size: 11,
    x: PAGE.marginX,
    color: COLORS.muted,
  });
  state = drawPdfLine(state, 'Key sections: Deal Metrics, Overview, Notes', {
    font: regularFont,
    size: 10,
    x: PAGE.marginX,
    color: COLORS.muted,
  });
  state = { ...state, cursorY: state.cursorY - 8 };

  state = drawPdfSection(pdfDoc, state, 'Deal Metrics', sections.metrics, regularFont, boldFont);
  state = drawPdfSection(pdfDoc, state, 'Property Overview', sections.overview, regularFont, boldFont);

  const noteLines = wrapPdfText(sections.notes, regularFont, 10, PAGE.width - PAGE.marginX * 2 - 24);
  state = ensurePdfSpace(pdfDoc, state, 40 + noteLines.length * 16);

  const noteTop = state.cursorY + 10;
  const noteWidth = PAGE.width - PAGE.marginX * 2;
  const noteHeaderHeight = 24;
  const noteBodyHeight = Math.max(36, noteLines.length * 14 + 16);
  state.page.drawRectangle({
    x: PAGE.marginX,
    y: noteTop - noteHeaderHeight,
    width: noteWidth,
    height: noteHeaderHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.sectionFill,
  });
  state.page.drawRectangle({
    x: PAGE.marginX,
    y: noteTop - noteHeaderHeight - noteBodyHeight,
    width: noteWidth,
    height: noteBodyHeight,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  state.page.drawText('Notes', {
    x: PAGE.marginX + 12,
    y: noteTop - 16,
    size: 11,
    font: boldFont,
    color: COLORS.text,
  });
  let noteY = noteTop - noteHeaderHeight - 18;
  for (const line of noteLines) {
    if (line) {
      state.page.drawText(line, {
        x: PAGE.marginX + 12,
        y: noteY,
        size: 10,
        font: regularFont,
        color: COLORS.text,
      });
    }
    noteY -= 14;
  }

  const footerText = 'Generated by PropNexus property detail export.';
  const footerWidth = regularFont.widthOfTextAtSize(footerText, 9);
  state.page.drawText(footerText, {
    x: PAGE.width - PAGE.marginX - footerWidth,
    y: PAGE.marginY - 10,
    size: 9,
    font: regularFont,
    color: COLORS.muted,
  });

  const bytes = await pdfDoc.save();
  triggerPdfDownload(createPropertyPdfFilename(input), bytes);
}
