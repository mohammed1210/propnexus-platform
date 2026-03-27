import '@testing-library/jest-dom';

import { getPropertyPdfSections } from './propertyPdfExport';

describe('propertyPdfExport rent parsing', () => {
  it('reads rent_monthly when present', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p1',
      property: {
        title: 'Deal 1',
        location: 'Leeds',
        rent_monthly: 1450,
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Estimated Rent (PCM)',
      value: '£1,450',
    });
  });

  it('parses formatted rent strings like "£1,000 pcm"', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p2',
      property: {
        title: 'Deal 2',
        location: 'London',
        rent_pcm: '£1,000 pcm',
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Estimated Rent (PCM)',
      value: '£1,000',
    });
  });

  it('falls back to N/A when no rent field is parseable', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p3',
      property: {
        title: 'Deal 3',
        location: 'Bristol',
        rent_pcm: 'unknown',
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Estimated Rent (PCM)',
      value: 'N/A',
    });
  });
});
