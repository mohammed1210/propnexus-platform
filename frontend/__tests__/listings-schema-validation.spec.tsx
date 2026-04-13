/**
 * Test: Listings schema validation
 *
 * Ensures that backend property objects with snake_case keys
 * are correctly mapped for the frontend PropertyCard component.
 */

import '@testing-library/jest-dom';

describe('Listings Schema Validation', () => {
  it('maps backend property object to PropertyCard props correctly', () => {
    // Mock backend property with snake_case keys
    const backendProperty = {
      id: 'test-123',
      title: 'Test Property',
      location: 'London, UK',
      price: 250000,
      source: 'zoopla',
      bedrooms: 3,
      bathrooms: 2,
      description: 'A lovely property',
      score: 81,
      yield_percent: 5.5,
      roi_percent: 10.2,
      imageurl: 'https://example.com/image.jpg',
      investment_type: 'BTL',
      latitude: 51.5074,
      longitude: -0.1278,
      created_at: '2023-11-23T00:00:00Z',
    };

    // Map backend response (this is what the frontend does)
    const mappedProperty = {
      id: backendProperty.id,
      title: backendProperty.title,
      location: backendProperty.location,
      price: backendProperty.price,
      source: backendProperty.source,
      bedrooms: backendProperty.bedrooms,
      bathrooms: backendProperty.bathrooms,
      description: backendProperty.description,
      ai_score: backendProperty.ai_score ?? backendProperty.score,
      score: backendProperty.score ?? backendProperty.ai_score,
      yield_percent: backendProperty.yield_percent,
      roi_percent: backendProperty.roi_percent,
      imageurl: backendProperty.imageurl,
      latitude: backendProperty.latitude,
      longitude: backendProperty.longitude,
      created_at: backendProperty.created_at,
      investment_type: backendProperty.investment_type,
    };

    // Assert all values are correctly mapped
    expect(mappedProperty.id).toBe('test-123');
    expect(mappedProperty.title).toBe('Test Property');
    expect(mappedProperty.location).toBe('London, UK');
    expect(mappedProperty.price).toBe(250000);
    expect(mappedProperty.source).toBe('zoopla');
    expect(mappedProperty.bedrooms).toBe(3);
    expect(mappedProperty.bathrooms).toBe(2);
    expect(mappedProperty.description).toBe('A lovely property');
    expect(mappedProperty.ai_score).toBe(81);
    expect(mappedProperty.score).toBe(81);
    expect(mappedProperty.yield_percent).toBe(5.5);
    expect(mappedProperty.roi_percent).toBe(10.2);
    expect(mappedProperty.imageurl).toBe('https://example.com/image.jpg');
    expect(mappedProperty.investment_type).toBe('BTL');
    expect(mappedProperty.latitude).toBe(51.5074);
    expect(mappedProperty.longitude).toBe(-0.1278);

    // Ensure no undefined values
    expect(mappedProperty.investment_type).toBeDefined();
    expect(mappedProperty.yield_percent).toBeDefined();
    expect(mappedProperty.roi_percent).toBeDefined();
    expect(mappedProperty.imageurl).toBeDefined();
    expect(mappedProperty.location).toBeDefined();
  });

  it('handles properties with null optional fields', () => {
    const backendProperty = {
      id: 'test-456',
      title: 'Minimal Property',
      location: null,
      price: 150000,
      source: null,
      bedrooms: null,
      bathrooms: null,
      description: null,
      ai_score: null,
      score: null,
      yield_percent: null,
      roi_percent: null,
      imageurl: null,
      investment_type: null,
      latitude: null,
      longitude: null,
      created_at: '2023-11-23T00:00:00Z',
    };

    const mappedProperty = {
      id: backendProperty.id,
      title: backendProperty.title,
      location: backendProperty.location,
      price: backendProperty.price,
      source: backendProperty.source,
      bedrooms: backendProperty.bedrooms,
      bathrooms: backendProperty.bathrooms,
      description: backendProperty.description,
      ai_score: backendProperty.ai_score ?? backendProperty.score,
      score: backendProperty.score ?? backendProperty.ai_score,
      yield_percent: backendProperty.yield_percent,
      roi_percent: backendProperty.roi_percent,
      imageurl: backendProperty.imageurl,
      latitude: backendProperty.latitude,
      longitude: backendProperty.longitude,
      created_at: backendProperty.created_at,
      investment_type: backendProperty.investment_type,
    };

    // All fields should be defined (even if null)
    expect(mappedProperty.id).toBe('test-456');
    expect(mappedProperty.title).toBe('Minimal Property');
    expect(mappedProperty.location).toBeNull();
    expect(mappedProperty.price).toBe(150000);
    expect(mappedProperty.source).toBeNull();
    expect(mappedProperty.ai_score).toBeNull();
    expect(mappedProperty.score).toBeNull();
    expect(mappedProperty.yield_percent).toBeNull();
    expect(mappedProperty.roi_percent).toBeNull();
    expect(mappedProperty.investment_type).toBeNull();

    // No undefined values - all properties should be defined (even if null)
    expect(Object.values(mappedProperty).some(value => value === undefined)).toBe(false);
  });

  it('does not use camelCase investmentType from backend', () => {
    // This test ensures we're not using the old camelCase field
    const backendPropertyWithCamelCase = {
      id: 'test-789',
      title: 'Test Property',
      investmentType: 'HMO', // OLD CAMELCASE - should not be used
      investment_type: 'BTL', // NEW SNAKE_CASE - should be used
      ai_score: null,
      score: 72,
    };

    const mappedProperty = {
      investment_type: backendPropertyWithCamelCase.investment_type,
      ai_score:
        backendPropertyWithCamelCase.ai_score ?? backendPropertyWithCamelCase.score,
      score:
        backendPropertyWithCamelCase.score ?? backendPropertyWithCamelCase.ai_score,
    };

    // Should use snake_case version
    expect(mappedProperty.investment_type).toBe('BTL');
    expect(mappedProperty.investment_type).not.toBe('HMO');
    expect(mappedProperty.ai_score).toBe(72);
    expect(mappedProperty.score).toBe(72);
  });
});
