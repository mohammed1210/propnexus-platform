import { looksLikeUrl, normalizeUkPostcode, parseListingText } from '@/lib/parseListingText';

describe('parseListingText', () => {
  it('extracts price, bedrooms, bathrooms, postcode, rent and property type', () => {
    const parsed = parseListingText(`
      Spacious 2 bedroom flat in Leeds LS1 4AB
      Asking price £250,000
      Rent: £1,450 pcm
      1 bathroom
      Great city-centre apartment investment.
    `);

    expect(parsed.title).toBe('Spacious 2 bedroom flat in Leeds LS1 4AB');
    expect(parsed.price).toBe(250000);
    expect(parsed.bedrooms).toBe(2);
    expect(parsed.bathrooms).toBe(1);
    expect(parsed.postcode).toBe('LS1 4AB');
    expect(parsed.estimatedMonthlyRent).toBe(1450);
    expect(parsed.propertyType).toBe('Flat');
  });

  it('detects URL strings without fetching them', () => {
    expect(looksLikeUrl('https://www.rightmove.co.uk/example')).toBe(true);
    expect(looksLikeUrl('Leeds LS1 4AB')).toBe(false);
  });

  it('normalizes UK postcodes', () => {
    expect(normalizeUkPostcode('ls14ab')).toBe('LS1 4AB');
  });
});
