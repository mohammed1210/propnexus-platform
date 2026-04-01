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

  it('derives Yield and ROI from rent and price when explicit metrics are missing', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p4',
      property: {
        title: 'Deal 4',
        location: 'Manchester',
        price: 240000,
        rent_monthly: 1200,
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Yield',
      value: '6.0%',
    });
    expect(sections.metrics).toContainEqual({
      label: 'ROI',
      value: '6.0%',
    });
  });

  it('prefers explicit ROI when provided over proxy fallback', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p5',
      property: {
        title: 'Deal 5',
        location: 'Liverpool',
        price: 200000,
        rent_monthly: 1000,
      },
      roiPercent: 14.2,
    });

    expect(sections.metrics).toContainEqual({
      label: 'ROI',
      value: '14.2%',
    });
  });

  it('preserves property Yield/ROI when optional overrides are omitted', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p6',
      property: {
        title: 'Deal 6',
        location: 'Sheffield',
        yield_percent: 7.3,
        roi_percent: 12.8,
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Yield',
      value: '7.3%',
    });
    expect(sections.metrics).toContainEqual({
      label: 'ROI',
      value: '12.8%',
    });
  });

  it('keeps parseable formatted property price for proxy derivation when input.price is omitted', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p7',
      property: {
        title: 'Deal 7',
        location: 'Leicester',
        price: '£240,000',
        rent_monthly: '£1,200 pcm',
      },
    });

    expect(sections.metrics).toContainEqual({
      label: 'Yield',
      value: '6.0%',
    });
    expect(sections.metrics).toContainEqual({
      label: 'ROI',
      value: '6.0%',
    });
  });

  it('uses a stronger empty-state summary when no description is provided', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p8',
      property: {
        title: 'Deal 8',
        location: 'Birmingham',
      },
    });

    expect(sections.notes).toContain('does not currently include a narrative description');
    expect(sections.notes).not.toBe('No description provided.');
    expect(sections.hasNarrativeDescription).toBe(false);
  });

  it('marks real narrative descriptions so the paginator can prefer the full summary block', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p8b',
      property: {
        title: 'Narrative Deal',
        location: 'Birmingham',
        description: 'Short but real investor summary.',
      },
    });

    expect(sections.hasNarrativeDescription).toBe(true);
  });

  it('captures the primary property image URL when available', () => {
    const sections = getPropertyPdfSections({
      propertyId: 'p9',
      property: {
        title: 'Deal 9',
        location: 'York',
        image_urls: ['https://images.example.com/cover.jpg'],
      },
    });

    expect(sections.imageUrl).toBe('https://images.example.com/cover.jpg');
  });
});
