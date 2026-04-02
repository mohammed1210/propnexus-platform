import '@testing-library/jest-dom';

const mockSave = jest.fn(async () => new Uint8Array([1, 2, 3]));
const mockEmbedJpg = jest.fn(async () => ({ width: 1600, height: 900 }));
const mockEmbedPng = jest.fn(async () => ({ width: 1200, height: 900 }));
const mockEmbedFont = jest.fn(async () => ({
  widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
}));
const mockDrawText = jest.fn();
const mockDrawRectangle = jest.fn();
const mockDrawLine = jest.fn();
const mockDrawImage = jest.fn();
const mockPages: Array<{
  drawText: typeof mockDrawText;
  drawRectangle: typeof mockDrawRectangle;
  drawLine: typeof mockDrawLine;
  drawImage: typeof mockDrawImage;
}> = [];
const mockAddPage = jest.fn(() => {
  const page = {
    drawText: mockDrawText,
    drawRectangle: mockDrawRectangle,
    drawLine: mockDrawLine,
    drawImage: mockDrawImage,
  };
  mockPages.push(page);
  return page;
});

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn(async () => ({
      addPage: mockAddPage,
      embedFont: mockEmbedFont,
      embedJpg: mockEmbedJpg,
      embedPng: mockEmbedPng,
      getPages: () => mockPages,
      save: mockSave,
    })),
  },
  StandardFonts: {
    Helvetica: 'Helvetica',
    HelveticaBold: 'HelveticaBold',
  },
  rgb: (r: number, g: number, b: number) => ({ r, g, b }),
}));

describe('exportPropertyPdf', () => {
  const oldCreateObjectURL = URL.createObjectURL;
  const oldRevokeObjectURL = URL.revokeObjectURL;
  const oldFetch = global.fetch;
  const clickSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPages.length = 0;
    URL.createObjectURL = jest.fn(() => 'blob:mock-pdf');
    URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn(async () =>
      new Response(Uint8Array.from([255, 216, 255, 217]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    ) as any;
    HTMLAnchorElement.prototype.click = clickSpy;
  });

  afterEach(() => {
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
    global.fetch = oldFetch;
  });

  it('keeps a short executive summary on page 1 and triggers a download', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-123',
      property: {
        title: 'Central Flat',
        location: 'Leeds',
        description: 'Strong rental demand and solid transport links.',
        bedrooms: 2,
        bathrooms: 1,
        property_type: 'Flat',
        investment_type: 'Buy to Let',
        image_urls: ['https://images.example.com/cover.jpg'],
      },
      price: 210000,
      yieldPercent: 6.4,
      roiPercent: 8.1,
      aiScore: 8.7,
      url: 'https://app.example/properties/prop-123',
    });

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockDrawText).toHaveBeenCalledWith(
      'PropNexus',
      expect.objectContaining({ size: 13 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      'Investor Deal Pack',
      expect.objectContaining({ size: 24 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      'Deal Snapshot',
      expect.objectContaining({ size: 14 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      'Deal Highlights',
      expect.objectContaining({ size: 12 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      'Investment Insight',
      expect.objectContaining({ size: 12 }),
    );
    expect(mockAddPage).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/pdf-image?host=images.example.com&protocol=https%3A&path=%2Fcover.jpg',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      }),
    );
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf');
  });

  it('degrades gracefully when property image fetch fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('image fetch failed');
    }) as any;

    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-no-image',
      property: {
        title: 'No Image Deal',
        location: 'Bristol',
        image_url: 'https://images.example.com/missing.jpg',
      },
      price: 180000,
    });

    expect(mockDrawImage).not.toHaveBeenCalled();
    expect(
      mockDrawText.mock.calls.some(
        ([text]) => typeof text === 'string' && text.includes('Listing image unavailable at export time'),
      ),
    ).toBe(true);
    expect(
      mockDrawText.mock.calls.some(
        ([text]) =>
          typeof text === 'string' &&
          text.includes('Key investment signals and deal context remain available below'),
      ),
    ).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('uses a compact summary block for missing narrative without creating a mostly empty second page', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-no-description',
      property: {
        title: 'Compact Summary Deal',
        location: 'South East London',
        property_type: 'House',
        investment_type: 'BRRR',
      },
      price: 395000,
      yieldPercent: 5.4,
      roiPercent: 9.2,
    });

    expect(mockAddPage).toHaveBeenCalledTimes(1);
    expect(
      mockDrawText.mock.calls.some(
        ([text, options]) =>
          typeof text === 'string' &&
          text.includes('Summary Snapshot') &&
          options &&
          (options as { size?: number }).size === 12,
      ),
    ).toBe(true);
    expect(
      mockDrawText.mock.calls.some(
        ([text, options]) =>
          typeof text === 'string' &&
          text.includes('Narrative detail is limited') &&
          options &&
          (options as { size?: number }).size === 9,
      ),
    ).toBe(true);
  });

  it('creates page 2 only when longer narrative text genuinely overflows', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-long-summary',
      property: {
        title:
          'Exceptional semi-detached investment opportunity with extensive refurbishment upside and strong commuter demand',
        location: 'South East London',
        property_type: 'House',
        investment_type: 'BRRR',
        description: Array.from({ length: 18 }, () =>
          'This asset combines strong rental demand, realistic refurbishment upside, commuter access, family-house appeal, and a clear refinance pathway for an investor seeking durable cash flow with multiple operational levers still to verify on inspection.',
        ).join(' '),
      },
      price: 395000,
      yieldPercent: 5.4,
      roiPercent: 9.2,
    });

    expect(
      mockDrawText.mock.calls.some(
        ([text, options]) =>
          typeof text === 'string' &&
          text.includes('Exceptional') &&
          options &&
          (options as { size?: number }).size === 18,
      ),
    ).toBe(true);
    expect(mockAddPage).toHaveBeenCalledTimes(2);
    expect(
      mockDrawText.mock.calls.some(
        ([text]) => typeof text === 'string' && text.includes('Executive Summary'),
      ),
    ).toBe(true);
  });

  it('avoids a blank PDF when imagery and narrative are both sparse', async () => {
    global.fetch = jest.fn(async () =>
      new Response(null, {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    ) as any;

    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-blank-guard',
      property: {
        title: 'Lean Deal',
        location: 'Hull',
      },
      price: 99000,
    });

    expect(mockAddPage).toHaveBeenCalledTimes(1);
    expect(mockDrawText.mock.calls.length).toBeGreaterThan(0);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('renders cleaner placeholder metric states and truncated source URLs', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-clean-url',
      property: {
        title: 'URL Deal',
        location: 'Manchester',
        description: 'Chain free terrace with straightforward rental appeal and solid commuter access.',
        rent_monthly: 1250,
      },
      price: 180000,
      url: 'https://www.example.com/properties/investments/north-west/manchester/very-long-source-path/with-additional-context?utm_source=propnexus&utm_medium=pdf&utm_campaign=deal-pack',
    });

    expect(
      mockDrawText.mock.calls.some(
        ([text]) => typeof text === 'string' && text.includes('Not scored'),
      ),
    ).toBe(true);
    expect(
      mockDrawText.mock.calls.some(
        ([text]) => typeof text === 'string' && text.includes('Pending'),
      ),
    ).toBe(true);
    expect(
      mockDrawText.mock.calls.some(
        ([text]) =>
          typeof text === 'string' &&
          text.includes('example.com/properties/investments') &&
          text.includes('…') &&
          !text.includes('https://'),
      ),
    ).toBe(true);
  });

  it('keeps title metadata chips clear of the Deal Snapshot section', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-title-spacing',
      property: {
        title: 'Westrow Gardens, Ilford, IG3',
        location: 'Westrow Gardens, Ilford, IG3',
        property_type: 'Bungalow',
        investment_type: 'BTL',
        bedrooms: 6,
        bathrooms: 3,
        rent_monthly: 5833,
        image_urls: ['https://images.example.com/cover.jpg'],
      },
      price: 1000000,
      yieldPercent: 7,
      roiPercent: 9.4,
    });

    const dealSnapshotCall = mockDrawText.mock.calls.find(([text]) => text === 'Deal Snapshot');
    const chipBottoms = mockDrawRectangle.mock.calls
      .map(([options]) => options as { y?: number; height?: number })
      .filter((options) => options.height === 15 && typeof options.y === 'number')
      .map((options) => options.y as number);

    expect(dealSnapshotCall).toBeDefined();
    expect(chipBottoms.length).toBeGreaterThan(0);
    expect((dealSnapshotCall?.[1] as { y?: number }).y).toBeLessThan(Math.min(...chipBottoms) - 10);
  });
});
