import { extractLikelyUkPostcode } from '@/components/PropertyCard';

describe('PropertyCard postcode extraction', () => {
  it('prefers full postcodes so listing insights use tighter comparable params', () => {
    expect(extractLikelyUkPostcode('IG3 IG3 8DN Ilford')).toBe('IG38DN');
    expect(extractLikelyUkPostcode('Flat 2, Example Street, IG3 8DN')).toBe('IG38DN');
  });

  it('falls back to outward postcode when no full postcode is available', () => {
    expect(extractLikelyUkPostcode('Ilford IG3')).toBe('IG3');
  });
});
