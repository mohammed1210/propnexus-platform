import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract with safe defaults
    const title = String(body?.title ?? 'Property');
    const location = String(body?.location ?? '');
    const price = Number(body?.price ?? 0);
    const yieldPct = Number(body?.yield_percent ?? 0);
    const roiPct = Number(body?.roi_percent ?? 0);
    const postcode = String(body?.postcode ?? '');
    const aiOverall = Number(body?.ai_overall ?? 0);
    const aiItems: { label: string; value: number }[] = body?.ai_items ?? [];

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width } = page.getSize();
    const margin = 50;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;

    // Header
    page.drawText('PropNexus — Deal Pack', { x: margin, y, size: 14, font: bold });
    y -= 24;
    page.drawText(title, { x: margin, y, size: 18, font: bold });
    y -= 18;
    page.drawText(`${location}${postcode ? ` • ${postcode}` : ''}`, { x: margin, y, size: 11, font });
    y -= 24;

    // Summary box
    page.drawRectangle({ x: margin, y: y - 70, width: width - margin * 2, height: 70, color: rgb(0.96, 0.97, 1) });
    page.drawText(`Price: £${price ? price.toLocaleString() : 'N/A'}`, { x: margin + 10, y: y - 18, size: 12, font });
    page.drawText(`Yield: ${yieldPct || 0}%`, { x: margin + 10, y: y - 36, size: 12, font });
    page.drawText(`ROI: ${roiPct || 0}%`, { x: margin + 10, y: y - 54, size: 12, font });
    y -= 90;

    // AI score
    page.drawText('AI Deal Score', { x: margin, y, size: 13, font: bold });
    page.drawText(`Overall: ${aiOverall}`, { x: margin + 140, y, size: 12, font });
    y -= 18;

    // Bars
    const barW = width - margin * 2 - 140;
    const barH = 10;
    aiItems.slice(0, 6).forEach((it) => {
      const v = Math.max(0, Math.min(100, Number(it.value || 0)));
      page.drawText(it.label, { x: margin, y, size: 11, font });
      page.drawRectangle({ x: margin + 140, y: y - 2, width: barW, height: barH, color: rgb(0.92, 0.92, 0.92) });
      page.drawRectangle({ x: margin + 140, y: y - 2, width: (barW * v) / 100, height: barH, color: rgb(0.2, 0.45, 0.9) });
      page.drawText(`${v}%`, { x: margin + 140 + barW + 8, y, size: 10, font });
      y -= 18;
    });

    y -= 8;
    page.drawText(
      'Indicative only — based on yield, ROI, area demand and risk. Validate with your own due diligence.',
      { x: margin, y, size: 9, font }
    );

    const bytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="propnexus-deal-pack.pdf"`,
      },
    });
  } catch (e) {
    console.error('deal-pack route error', e);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}