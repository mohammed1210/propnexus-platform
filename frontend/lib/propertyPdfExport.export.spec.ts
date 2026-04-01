import '@testing-library/jest-dom';

const mockSave = jest.fn(async () => new Uint8Array([1, 2, 3]));
const mockEmbedFont = jest.fn(async () => ({
  widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5,
}));
const mockDrawText = jest.fn();
const mockDrawRectangle = jest.fn();
const mockAddPage = jest.fn(() => ({
  drawText: mockDrawText,
  drawRectangle: mockDrawRectangle,
}));

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn(async () => ({
      addPage: mockAddPage,
      embedFont: mockEmbedFont,
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
  const clickSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:mock-pdf');
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = clickSpy;
  });

  afterEach(() => {
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
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
      },
      price: 210000,
      yieldPercent: 6.4,
      roiPercent: 8.1,
      aiScore: 8.7,
      url: 'https://app.example/properties/prop-123',
    });

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockDrawText).toHaveBeenCalledWith(
      'PropNexus Property Deal Export',
      expect.objectContaining({ size: 20 }),
    );
    expect(mockDrawText).toHaveBeenCalledWith(
      expect.stringContaining('Central Flat - Leeds'),
      expect.objectContaining({ size: 11 }),
    );
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-pdf');
  });
});
