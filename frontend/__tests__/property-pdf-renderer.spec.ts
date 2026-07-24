/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockChromiumExecutablePath = jest.fn();
const mockLaunch = jest.fn();

jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: {
    args: ['--no-sandbox'],
    executablePath: (...args: unknown[]) => mockChromiumExecutablePath(...args),
  },
}));

jest.mock('playwright-core', () => ({
  chromium: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

type MockRequestOptions = {
  url: string;
  headers?: Record<string, string>;
  isNavigationRequest?: boolean;
  resourceType?: string;
};

function createRoute({
  url,
  headers = { accept: '*/*' },
  isNavigationRequest = false,
  resourceType = 'image',
}: MockRequestOptions) {
  const continueMock = jest.fn(async () => undefined);

  return {
    continueMock,
    route: {
      continue: continueMock,
      request: () => ({
        headers: () => headers,
        isNavigationRequest: () => isNavigationRequest,
        resourceType: () => resourceType,
        url: () => url,
      }),
    },
  };
}

describe('renderDealPackPdfFromUrl', () => {
  let routeHandler: ((route: any) => Promise<void>) | undefined;
  let page: {
    route: jest.Mock;
    emulateMedia: jest.Mock;
    goto: jest.Mock;
    waitForSelector: jest.Mock;
    evaluate: jest.Mock;
    pdf: jest.Mock;
  };
  let close: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    routeHandler = undefined;

    page = {
      route: jest.fn(async (_pattern, handler: (route: any) => Promise<void>) => {
        routeHandler = handler;
      }),
      emulateMedia: jest.fn(async () => undefined),
      goto: jest.fn(async () => ({ ok: () => true, status: () => 200 })),
      waitForSelector: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => undefined),
      pdf: jest.fn(async () => Uint8Array.from([37, 80, 68, 70])),
    };
    close = jest.fn(async () => undefined);

    mockChromiumExecutablePath.mockResolvedValue('/tmp/chromium');
    mockLaunch.mockResolvedValue({
      newPage: jest.fn(async () => page),
      close,
    });
  });

  it('attaches the render header to the exact same-origin deal pack document request', async () => {
    const { renderDealPackPdfFromUrl } = await import('@/lib/server/propertyPdfRenderer');

    await renderDealPackPdfFromUrl('https://app.example/property/prop-123/deal-pack?source=abc', {
      headers: { 'X-PropNexus-PDF-Render-Token': 'secret-token' },
    });

    const route = createRoute({
      url: 'https://app.example/property/prop-123/deal-pack?source=abc',
      headers: { accept: 'text/html' },
      isNavigationRequest: true,
      resourceType: 'document',
    });

    await routeHandler?.(route.route);

    expect(route.continueMock).toHaveBeenCalledWith({
      headers: {
        accept: 'text/html',
        'X-PropNexus-PDF-Render-Token': 'secret-token',
      },
    });
  });

  it('does not attach the render header to same-origin css or image subresources', async () => {
    const { renderDealPackPdfFromUrl } = await import('@/lib/server/propertyPdfRenderer');

    await renderDealPackPdfFromUrl('https://app.example/property/prop-123/deal-pack', {
      headers: { 'X-PropNexus-PDF-Render-Token': 'secret-token' },
    });

    const cssRoute = createRoute({
      url: 'https://app.example/_next/static/app.css',
      isNavigationRequest: false,
      resourceType: 'stylesheet',
    });
    const imageRoute = createRoute({
      url: 'https://app.example/images/listing.jpg',
      isNavigationRequest: false,
      resourceType: 'image',
    });

    await routeHandler?.(cssRoute.route);
    await routeHandler?.(imageRoute.route);

    expect(cssRoute.continueMock).toHaveBeenCalledWith();
    expect(imageRoute.continueMock).toHaveBeenCalledWith();
  });

  it('does not attach the render header to third-party image requests', async () => {
    const { renderDealPackPdfFromUrl } = await import('@/lib/server/propertyPdfRenderer');

    await renderDealPackPdfFromUrl('https://app.example/property/prop-123/deal-pack', {
      headers: { 'X-PropNexus-PDF-Render-Token': 'secret-token' },
    });

    const route = createRoute({
      url: 'https://images.example-cdn.com/property.jpg',
      isNavigationRequest: false,
      resourceType: 'image',
    });

    await routeHandler?.(route.route);

    expect(route.continueMock).toHaveBeenCalledWith();
  });

  it('does not attach the render header to a different same-origin document path', async () => {
    const { renderDealPackPdfFromUrl } = await import('@/lib/server/propertyPdfRenderer');

    await renderDealPackPdfFromUrl('https://app.example/property/prop-123/deal-pack', {
      headers: { 'X-PropNexus-PDF-Render-Token': 'secret-token' },
    });

    const route = createRoute({
      url: 'https://app.example/property/prop-123',
      headers: { accept: 'text/html' },
      isNavigationRequest: true,
      resourceType: 'document',
    });

    await routeHandler?.(route.route);

    expect(route.continueMock).toHaveBeenCalledWith();
  });

  it('still renders the PDF successfully through the authorised path', async () => {
    const { renderDealPackPdfFromUrl } = await import('@/lib/server/propertyPdfRenderer');

    const pdf = await renderDealPackPdfFromUrl('https://app.example/property/prop-123/deal-pack', {
      headers: { 'X-PropNexus-PDF-Render-Token': 'secret-token' },
    });

    expect(page.goto).toHaveBeenCalledWith('https://app.example/property/prop-123/deal-pack', {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    expect(page.pdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
    });
    expect(pdf).toEqual(Uint8Array.from([37, 80, 68, 70]));
    expect(close).toHaveBeenCalled();
  });
});
