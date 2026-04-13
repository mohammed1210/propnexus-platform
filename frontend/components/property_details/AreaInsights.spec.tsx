import { hasMeaningfulIntel } from './AreaInsights';

describe('hasMeaningfulIntel', () => {
  it('returns false for null intel', () => {
    expect(hasMeaningfulIntel(null)).toBe(false);
  });

  it('returns false when all numeric intel fields are empty or zero', () => {
    expect(
      hasMeaningfulIntel({
        key: 'M1',
        population: 0,
        avg_price: 0,
        avg_rent: 0,
        rental_yield_percent: 0,
        crime_index: 0,
        schools_rating: 0,
      }),
    ).toBe(false);
  });

  it('returns true when at least one meaningful intel value exists', () => {
    expect(
      hasMeaningfulIntel({
        key: 'M1',
        population: 0,
        avg_price: 250000,
        avg_rent: 0,
        rental_yield_percent: 0,
        crime_index: 0,
        schools_rating: 0,
      }),
    ).toBe(true);
  });
});
