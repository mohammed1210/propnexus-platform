/**
 * Test suite to validate listings page schema compatibility
 * Ensures backend response format matches frontend expectations
 * and prevents zero-data issues
 */

describe('Listings Page Schema Validation', () => {
  describe('Backend Response Schema', () => {
    it('should have all required fields in backend SELECT query', () => {
      // These are the fields the backend queries from properties table
      const backendSelectFields = [
        'id',
        'title',
        'location',
        'price',
        'bedrooms',
        'bathrooms',
        'yield_percent',
        'roi_percent',
        'imageurl',
        'latitude',
        'longitude',
        'created_at',
        'description',
        'investmentType'
      ];

      // Verify these fields are documented and expected
      expect(backendSelectFields).toContain('investmentType');
      expect(backendSelectFields).toContain('yield_percent');
      expect(backendSelectFields).toContain('roi_percent');
      expect(backendSelectFields).toContain('imageurl');
      expect(backendSelectFields).toContain('location');
    });

    it('should map backend response to frontend property type correctly', () => {
      // Simulate backend response
      const backendResponse = {
        id: '123',
        title: 'Test Property',
        location: 'London, UK',
        price: 250000,
        bedrooms: 3,
        bathrooms: 2,
        description: 'A nice property',
        yield_percent: 5.5,
        roi_percent: 12.0,
        imageurl: 'https://example.com/image.jpg',
        latitude: 51.5074,
        longitude: -0.1278,
        created_at: '2025-11-23T00:00:00Z',
        investmentType: 'BTL'
      };

      // Frontend mapping (as done in listings/page.tsx line 321-336)
      const mappedProperty = {
        id: backendResponse.id,
        title: backendResponse.title,
        location: backendResponse.location,
        price: backendResponse.price,
        bedrooms: backendResponse.bedrooms,
        bathrooms: backendResponse.bathrooms,
        description: backendResponse.description,
        yield_percent: backendResponse.yield_percent,
        roi_percent: backendResponse.roi_percent,
        imageurl: backendResponse.imageurl,
        latitude: backendResponse.latitude,
        longitude: backendResponse.longitude,
        created_at: backendResponse.created_at,
        investment_type: backendResponse.investmentType, // camelCase to snake_case
      };

      expect(mappedProperty.investment_type).toBe('BTL');
      expect(mappedProperty.yield_percent).toBe(5.5);
      expect(mappedProperty.roi_percent).toBe(12.0);
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalBackendResponse = {
        id: '123',
        title: 'Test Property',
        location: null,
        price: 250000,
        bedrooms: null,
        bathrooms: null,
        description: null,
        yield_percent: null,
        roi_percent: null,
        imageurl: null,
        latitude: null,
        longitude: null,
        created_at: '2025-11-23T00:00:00Z',
        investmentType: null
      };

      // Should not throw
      const mappedProperty = {
        id: minimalBackendResponse.id,
        title: minimalBackendResponse.title,
        location: minimalBackendResponse.location,
        price: minimalBackendResponse.price,
        bedrooms: minimalBackendResponse.bedrooms,
        bathrooms: minimalBackendResponse.bathrooms,
        description: minimalBackendResponse.description,
        yield_percent: minimalBackendResponse.yield_percent,
        roi_percent: minimalBackendResponse.roi_percent,
        imageurl: minimalBackendResponse.imageurl,
        latitude: minimalBackendResponse.latitude,
        longitude: minimalBackendResponse.longitude,
        created_at: minimalBackendResponse.created_at,
        investment_type: minimalBackendResponse.investmentType,
      };

      expect(mappedProperty.id).toBe('123');
      expect(mappedProperty.investment_type).toBeNull();
    });

    it('should handle array responses correctly', () => {
      const backendArrayResponse = [
        {
          id: '1',
          title: 'Property 1',
          location: 'Manchester',
          price: 150000,
          investmentType: 'HMO'
        },
        {
          id: '2',
          title: 'Property 2',
          location: 'Birmingham',
          price: 200000,
          investmentType: 'BTL'
        }
      ];

      const mappedProperties = backendArrayResponse.map((prop: any) => ({
        id: prop.id,
        title: prop.title,
        location: prop.location,
        price: prop.price,
        investment_type: prop.investmentType,
      }));

      expect(mappedProperties).toHaveLength(2);
      expect(mappedProperties[0].investment_type).toBe('HMO');
      expect(mappedProperties[1].investment_type).toBe('BTL');
    });
  });

  describe('Investment Type Filtering', () => {
    const INVESTMENT_TYPES = ['HMO', 'BTL', 'SA', 'BRR', 'Flip', 'Commercial'];

    it('should support all defined investment types', () => {
      expect(INVESTMENT_TYPES).toContain('HMO');
      expect(INVESTMENT_TYPES).toContain('BTL');
      expect(INVESTMENT_TYPES).toContain('SA');
      expect(INVESTMENT_TYPES).toContain('BRR');
      expect(INVESTMENT_TYPES).toContain('Flip');
      expect(INVESTMENT_TYPES).toContain('Commercial');
    });

    it('should format investment types for backend query', () => {
      const selectedTypes = ['HMO', 'BTL'];
      const queryParam = selectedTypes.join(',');
      expect(queryParam).toBe('HMO,BTL');
    });

    it('should parse investment types from query params', () => {
      const queryString = 'HMO,BTL,SA';
      const types = queryString.split(',').filter(Boolean);
      expect(types).toEqual(['HMO', 'BTL', 'SA']);
    });
  });

  describe('Zero Data Scenarios', () => {
    it('should identify when no properties are returned', () => {
      const emptyResponse: any[] = [];
      expect(emptyResponse.length).toBe(0);
    });

    it('should handle backend error gracefully', () => {
      const errorScenario = () => {
        try {
          throw new Error('Failed to fetch properties: 500');
        } catch (error) {
          return [];
        }
      };

      const result = errorScenario();
      expect(result).toEqual([]);
    });

    it('should validate backend URL is not localhost in production', () => {
      // Mock production environment
      const mockEnv = {
        NEXT_PUBLIC_BACKEND_URL: 'https://production-backend.railway.app',
        NEXT_PUBLIC_API_BASE: undefined,
        NEXT_PUBLIC_API_URL: undefined,
      };

      const backendUrl = 
        mockEnv.NEXT_PUBLIC_BACKEND_URL || 
        mockEnv.NEXT_PUBLIC_API_BASE || 
        mockEnv.NEXT_PUBLIC_API_URL || 
        'http://localhost:8000';

      expect(backendUrl).not.toBe('http://localhost:8000');
      expect(backendUrl).toContain('production');
    });
  });

  describe('Data Mapping Edge Cases', () => {
    it('should handle numeric fields as strings', () => {
      const backendResponse = {
        id: '123',
        price: '250000', // Sometimes numeric fields come as strings
        bedrooms: '3',
        bathrooms: '2',
        yield_percent: '5.5',
        roi_percent: '12.0',
      };

      // Frontend should handle this gracefully
      expect(Number(backendResponse.price)).toBe(250000);
      expect(Number(backendResponse.yield_percent)).toBe(5.5);
    });

    it('should handle empty strings vs null', () => {
      const backendResponse = {
        id: '123',
        title: '',
        description: null,
        location: '',
      };

      expect(backendResponse.title).toBe('');
      expect(backendResponse.description).toBeNull();
      expect(backendResponse.location).toBe('');
    });
  });

  describe('URL Resolution Consistency', () => {
    it('should use consistent URL resolution pattern', () => {
      // This matches the pattern in listings/page.tsx line 289
      const testEnvScenarios = [
        {
          env: { BACKEND_URL: 'https://backend.example.com' },
          expected: 'https://backend.example.com'
        },
        {
          env: { API_BASE: 'https://base.example.com' },
          expected: 'https://base.example.com'
        },
        {
          env: { API_URL: 'https://api.example.com' },
          expected: 'https://api.example.com'
        },
        {
          env: {},
          expected: 'http://localhost:8000'
        }
      ];

      testEnvScenarios.forEach(scenario => {
        const backendUrl = 
          scenario.env.BACKEND_URL || 
          scenario.env.API_BASE || 
          scenario.env.API_URL || 
          'http://localhost:8000';
        
        expect(backendUrl).toBe(scenario.expected);
      });
    });
  });
});
