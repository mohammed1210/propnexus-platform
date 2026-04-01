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
const mockAddPage = jest.fn(() => ({
  drawText: mockDrawText,
  drawRectangle: mockDrawRectangle,
  drawLine: mockDrawLine,
  drawImage: mockDrawImage,
}));

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn(async () => ({
      addPage: mockAddPage,
      embedFont: mockEmbedFont,
      embedJpg: mockEmbedJpg,
      embedPng: mockEmbedPng,
      getPages: () => [mockAddPage.mock.results[0]?.value ?? mockAddPage()],
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

  it('renders a non-empty PDF payload and triggers a download', async () => {
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
      'Property Deal Export',
      expect.objectContaining({ size: 24 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      'Key Investment Metrics',
      expect.objectContaining({ size: 13 }),
    );
    expect(global.fetch).toHaveBeenCalledWith('https://images.example.com/cover.jpg');
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
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('handles long titles and missing notes without producing an unfinished export', async () => {
    const { exportPropertyPdf } = await import('./propertyPdfExport');

    await exportPropertyPdf({
      propertyId: 'prop-long-title',
      property: {
        title:
          'Exceptional semi-detached investment opportunity with extensive refurbishment upside and strong commuter demand',
        location: 'South East London',
        property_type: 'House',
        investment_type: 'BRRR',
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
          (options as { size?: number }).size === 21,
      ),
    ).toBe(true);
    expect(
      mockDrawText.mock.calls.some(
        ([text, options]) =>
          typeof text === 'string' &&
          text.includes('does not currently include a narrative description') &&
          options &&
          (options as { size?: number }).size === 10.5,
      ),
    ).toBe(true);
  });
});
