/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetchPropertyById = jest.fn();
const mockGetOptionalClerkUserId = jest.fn();
const mockRenderDealPackPdfFromUrl = jest.fn();
const mockGetServerEntitlements = jest.fn();

jest.mock('@/lib/server/propertyData', () => ({
  fetchPropertyById: (...args: unknown[]) => mockFetchPropertyById(...args),
  getOptionalClerkUserId: (...args: unknown[]) => mockGetOptionalClerkUserId(...args),
}));

jest.mock('@/lib/server/propertyPdfRenderer', () => ({
  renderDealPackPdfFromUrl: (...args: unknown[]) => mockRenderDealPackPdfFromUrl(...args),
}));

jest.mock('@/lib/server/userPlan', () => ({
  getServerEntitlements: (...args: unknown[]) => mockGetServerEntitlements(...args),
}));

describe('/api/property-pdf/[id]', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_FEATURE_DEAL_PACK = 'true';
    process.env.PROPNEXUS_INTERNAL_API_TOKEN = 'test-pdf-render-token';
    delete process.env.NEXT_PUBLIC_FEATURE_PROPERTY_EXPORTS;
    mockGetOptionalClerkUserId.mockResolvedValue('user_123');
    mockGetServerEntitlements.mockResolvedValue({ hasPdfExport: true });
    mockFetchPropertyById.mockResolvedValue({
      id: 'prop-123',
      title: 'Central Flat',
      location: 'Leeds',
    });
    mockRenderDealPackPdfFromUrl.mockResolvedValue(Uint8Array.from([37, 80, 68, 70]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a PDF response rendered from the deal-pack route', async () => {
    const { GET } = await import('@/app/api/property-pdf/[id]/route');
    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123?source=https%3A%2F%2Fapp.example%2Fproperty%2Fprop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('propnexus-central-flat-prop-123-');
    expect(mockFetchPropertyById).toHaveBeenCalledWith('prop-123', 'user_123');
    expect(mockRenderDealPackPdfFromUrl).toHaveBeenCalledWith(
      'https://app.example/property/prop-123/deal-pack?source=https%3A%2F%2Fapp.example%2Fproperty%2Fprop-123',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-PropNexus-PDF-Render-Token': expect.any(String) }),
      }),
    );
    expect(await res.arrayBuffer()).toEqual(Uint8Array.from([37, 80, 68, 70]).buffer);
  });

  it('returns a safe error payload when generation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRenderDealPackPdfFromUrl.mockRejectedValue(new Error('browser launch failed'));

    const { GET } = await import('@/app/api/property-pdf/[id]/route');
    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'pdf_generation_failed', message: 'browser launch failed' });
  });

  it('returns 404 when the deal pack flag is disabled', async () => {
    process.env.NEXT_PUBLIC_FEATURE_DEAL_PACK = 'false';
    const { GET } = await import('@/app/api/property-pdf/[id]/route');

    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(mockFetchPropertyById).not.toHaveBeenCalled();
    expect(mockRenderDealPackPdfFromUrl).not.toHaveBeenCalled();
  });

  it('returns 403 when the signed-in plan does not include PDF export', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasPdfExport: false });
    const { GET } = await import('@/app/api/property-pdf/[id]/route');

    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'upgrade_required', required_plan: 'investor_pro' });
    expect(mockFetchPropertyById).not.toHaveBeenCalled();
    expect(mockRenderDealPackPdfFromUrl).not.toHaveBeenCalled();
  });

  it('returns 404 only when the property is genuinely missing', async () => {
    mockFetchPropertyById.mockResolvedValue(null);
    const { GET } = await import('@/app/api/property-pdf/[id]/route');

    const res = await GET(new Request('https://app.example/api/property-pdf/missing-prop'), {
      params: Promise.resolve({ id: 'missing-prop' }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(mockFetchPropertyById).toHaveBeenCalledWith('missing-prop', 'user_123');
    expect(mockRenderDealPackPdfFromUrl).not.toHaveBeenCalled();
  });

  it('returns a safe configuration error without launching Playwright when the render token is missing', async () => {
    delete process.env.PROPNEXUS_INTERNAL_API_TOKEN;
    const { GET } = await import('@/app/api/property-pdf/[id]/route');

    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'pdf_render_unavailable' });
    expect(mockFetchPropertyById).not.toHaveBeenCalled();
    expect(mockRenderDealPackPdfFromUrl).not.toHaveBeenCalled();
  });

  it('returns 403 for an Investor Starter user before renderer launch', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasPdfExport: false });
    const { GET } = await import('@/app/api/property-pdf/[id]/route');

    const res = await GET(new Request('https://app.example/api/property-pdf/prop-123'), {
      params: Promise.resolve({ id: 'prop-123' }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'upgrade_required', required_plan: 'investor_pro' });
    expect(mockFetchPropertyById).not.toHaveBeenCalled();
    expect(mockRenderDealPackPdfFromUrl).not.toHaveBeenCalled();
  });

});
