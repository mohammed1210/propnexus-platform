import { NextResponse } from 'next/server';

import { createPropertyPdfFilename } from '@/lib/propertyDealPack';
import { FF } from '@/lib/flags';
import { renderDealPackPdfFromUrl } from '@/lib/server/propertyPdfRenderer';
import { getPdfRenderToken, PDF_RENDER_TOKEN_HEADER, redactPdfRenderToken } from '@/lib/server/pdfRenderAuth';
import { getServerEntitlements } from '@/lib/server/userPlan';
import { fetchPropertyById, getOptionalClerkUserId } from '@/lib/server/propertyData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Browser launch + page render + image loading can exceed the default serverless budget.
export const maxDuration = 60;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Robots-Tag': 'noindex',
} as const;

const encodeDispositionFilename = (filename: string) =>
  encodeURIComponent(filename)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!FF.DEAL_PACK) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStoreHeaders });
  }

  const entitlements = await getServerEntitlements();
  if (!entitlements.hasPdfExport) {
    return NextResponse.json(
      { error: 'upgrade_required', required_plan: 'investor_pro' },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const pdfRenderToken = getPdfRenderToken();
  if (!pdfRenderToken) {
    return NextResponse.json(
      { error: 'pdf_render_unavailable' },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const source = url.searchParams.get('source')?.trim() || undefined;

  try {
    const userId = await getOptionalClerkUserId();
    const property = await fetchPropertyById(id, userId);
    if (!property) {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStoreHeaders });
    }

    const filename = createPropertyPdfFilename({ propertyId: id, property, url: source });
    const dealPackUrl = new URL(`/property/${encodeURIComponent(id)}/deal-pack`, url.origin);
    if (source) {
      dealPackUrl.searchParams.set('source', source);
    }

    const pdfBytes = await renderDealPackPdfFromUrl(dealPackUrl.toString(), {
      headers: { [PDF_RENDER_TOKEN_HEADER]: pdfRenderToken },
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        ...noStoreHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeDispositionFilename(filename)}`,
      },
    });
  } catch (error) {
    const safeMessage = error instanceof Error ? redactPdfRenderToken(error.message) : 'Unexpected error.';
    console.error('Failed to generate property PDF', safeMessage);
    return NextResponse.json(
      { error: 'pdf_generation_failed', message: safeMessage },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
