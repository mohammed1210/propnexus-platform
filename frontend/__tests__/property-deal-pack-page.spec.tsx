/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetchPropertyById = jest.fn() as jest.MockedFunction<
  (propertyId: string, userId?: string | null) => Promise<Record<string, unknown> | null>
>;
const mockGetOptionalClerkUserId = jest.fn() as jest.MockedFunction<() => Promise<string | null>>;
const mockBuildPropertyDealPackModel = jest.fn() as jest.MockedFunction<
  (input: { propertyId: string; property: Record<string, unknown>; url?: string }) => { title: string }
>;
const mockGetServerEntitlements = jest.fn() as jest.MockedFunction<() => Promise<{ hasDealPack: boolean }>>;
const mockHeaders = jest.fn();
const notFoundError = Object.assign(new Error('not found'), {
  digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
});
const mockNotFound = jest.fn(() => {
  throw notFoundError;
});

jest.mock('@/lib/server/propertyData', () => ({
  fetchPropertyById: mockFetchPropertyById,
  getOptionalClerkUserId: mockGetOptionalClerkUserId,
}));

jest.mock('@/lib/propertyDealPack', () => ({
  buildPropertyDealPackModel: mockBuildPropertyDealPackModel,
}));

jest.mock('@/lib/server/userPlan', () => ({
  getServerEntitlements: () => mockGetServerEntitlements(),
}));

jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

jest.mock('@/components/UpgradeButton', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

jest.mock('@/components/property_details/PropertyDealPackTemplate', () => ({
  __esModule: true,
  default: ({ model }: { model: { title?: string } }) => <div data-testid="deal-pack-root">{model.title}</div>,
}));

describe('property/[id]/deal-pack/page', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_FEATURE_DEAL_PACK = 'true';
    process.env.PROPNEXUS_INTERNAL_API_TOKEN = 'test-pdf-render-token';
    mockGetOptionalClerkUserId.mockResolvedValue('user_123');
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: true });
    mockHeaders.mockResolvedValue(new Headers());
    mockFetchPropertyById.mockResolvedValue({ id: 'prop-123', title: 'Central Flat' });
    mockBuildPropertyDealPackModel.mockReturnValue({ title: 'Central Flat' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rethrows notFound errors for missing properties', async () => {
    mockFetchPropertyById.mockResolvedValue(null);

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;

    await expect(
      Page({
        params: Promise.resolve({ id: 'missing-prop' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  });

  it('renders the full template for an entitled user', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: true });

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;
    const result = await Page({
      params: Promise.resolve({ id: 'prop-123' }),
      searchParams: Promise.resolve({}),
    });

    render(result as React.ReactElement);

    expect(screen.getByTestId('deal-pack-root')).toBeInTheDocument();
    expect(screen.queryByText('Deal Pack preview')).not.toBeInTheDocument();
    expect(mockBuildPropertyDealPackModel).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'prop-123', property: expect.objectContaining({ id: 'prop-123' }) }),
    );
    expect(mockFetchPropertyById).toHaveBeenCalledWith('prop-123', 'user_123');
  });

  it('shows the gated preview for a Free user when the property exists', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: false });

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;
    const result = await Page({
      params: Promise.resolve({ id: 'prop-123' }),
      searchParams: Promise.resolve({}),
    });

    render(result as React.ReactElement);

    expect(screen.getByText('Deal Pack preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock investor pro/i })).toBeInTheDocument();
    expect(screen.queryByTestId('deal-pack-root')).not.toBeInTheDocument();
    expect(mockBuildPropertyDealPackModel).not.toHaveBeenCalled();
  });

  it('shows the gated preview for an Investor Starter user when the property exists', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: false });

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;
    const result = await Page({
      params: Promise.resolve({ id: 'prop-123' }),
      searchParams: Promise.resolve({}),
    });

    render(result as React.ReactElement);

    expect(screen.getByText('Deal Pack preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock investor pro/i })).toBeInTheDocument();
    expect(screen.queryByTestId('deal-pack-root')).not.toBeInTheDocument();
    expect(mockBuildPropertyDealPackModel).not.toHaveBeenCalled();
  });

  it('renders the full template for a valid internal PDF render request', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: false });
    mockHeaders.mockResolvedValue(new Headers({ 'X-PropNexus-PDF-Render-Token': 'test-pdf-render-token' }));

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;
    const result = await Page({
      params: Promise.resolve({ id: 'prop-123' }),
      searchParams: Promise.resolve({}),
    });

    render(result as React.ReactElement);

    expect(screen.getByTestId('deal-pack-root')).toBeInTheDocument();
    expect(mockBuildPropertyDealPackModel).toHaveBeenCalled();
  });

  it('keeps the preview for an invalid internal PDF render header', async () => {
    mockGetServerEntitlements.mockResolvedValue({ hasDealPack: false });
    mockHeaders.mockResolvedValue(new Headers({ 'X-PropNexus-PDF-Render-Token': 'wrong-token' }));

    const Page = (await import('../app/property/[id]/deal-pack/page')).default;
    const result = await Page({
      params: Promise.resolve({ id: 'prop-123' }),
      searchParams: Promise.resolve({}),
    });

    render(result as React.ReactElement);

    expect(screen.getByText('Deal Pack preview')).toBeInTheDocument();
    expect(screen.queryByTestId('deal-pack-root')).not.toBeInTheDocument();
    expect(mockBuildPropertyDealPackModel).not.toHaveBeenCalled();
  });
});
