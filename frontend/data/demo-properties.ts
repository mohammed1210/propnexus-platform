// Mock data for demo property detail pages
export interface DemoProperty {
  id: string;
  slug: string;
  title: string;
  address: string;
  image: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  premium: {
    dealScore: number;
    areaIntel: {
      crimeIndex: string;
      schoolRating: number;
      walkScore: number;
      rentGrowthYoY: number;
      domMedian: number;
    };
    investmentAnalytics: {
      capRate: number;
      cocReturn: number;
      irr5y: number;
      breakevenOcc: number;
      monthlyCashflow: number;
    };
    tradesmen: Array<{
      name: string;
      service: string;
      rating: number;
      eta: string;
      phone: string;
    }>;
  };
}

export const demoProperties: DemoProperty[] = [
  {
    id: 'demo-1',
    slug: 'oak-villa',
    title: 'Oak Villa',
    address: '42 Oak Lane, Manchester, M20 4GH',
    image: '/images/demo/oak-villa.webp',
    price: 325000,
    beds: 3,
    baths: 2,
    sqft: 1450,
    premium: {
      dealScore: 82,
      areaIntel: {
        crimeIndex: 'Low (28/100)',
        schoolRating: 8.5,
        walkScore: 72,
        rentGrowthYoY: 4.2,
        domMedian: 18,
      },
      investmentAnalytics: {
        capRate: 6.8,
        cocReturn: 12.4,
        irr5y: 14.2,
        breakevenOcc: 68,
        monthlyCashflow: 485,
      },
      tradesmen: [
        {
          name: 'Manchester Elite Builders',
          service: 'General Construction',
          rating: 4.8,
          eta: '2-3 days',
          phone: '+44-161-555-0123',
        },
        {
          name: 'QuickFix Plumbing',
          service: 'Plumbing & Heating',
          rating: 4.6,
          eta: 'Same day',
          phone: '+44-161-555-0456',
        },
        {
          name: 'PowerPro Electrical',
          service: 'Electrical Services',
          rating: 4.9,
          eta: '1-2 days',
          phone: '+44-161-555-0789',
        },
      ],
    },
  },
  {
    id: 'demo-2',
    slug: 'harbor-loft',
    title: 'Harbor Loft',
    address: '15 Waterfront Street, Liverpool, L1 8JQ',
    image: '/images/demo/harbor-loft.webp',
    price: 285000,
    beds: 2,
    baths: 2,
    sqft: 1100,
    premium: {
      dealScore: 76,
      areaIntel: {
        crimeIndex: 'Moderate (42/100)',
        schoolRating: 7.2,
        walkScore: 85,
        rentGrowthYoY: 3.8,
        domMedian: 22,
      },
      investmentAnalytics: {
        capRate: 6.2,
        cocReturn: 10.8,
        irr5y: 12.6,
        breakevenOcc: 72,
        monthlyCashflow: 395,
      },
      tradesmen: [
        {
          name: 'Liverpool Property Renovations',
          service: 'Full Renovations',
          rating: 4.7,
          eta: '3-5 days',
          phone: '+44-151-555-0234',
        },
        {
          name: 'Citywide HVAC Services',
          service: 'Heating & Ventilation',
          rating: 4.5,
          eta: '2-3 days',
          phone: '+44-151-555-0567',
        },
        {
          name: 'Elite Property Surveyors',
          service: 'Building Surveys',
          rating: 4.8,
          eta: '1 week',
          phone: '+44-151-555-0890',
        },
      ],
    },
  },
  {
    id: 'demo-3',
    slug: 'sunset-townhome',
    title: 'Sunset Townhome',
    address: '78 Sunset Boulevard, Birmingham, B15 2TT',
    image: '/images/demo/sunset-townhome.webp',
    price: 245000,
    beds: 2,
    baths: 1,
    sqft: 950,
    premium: {
      dealScore: 88,
      areaIntel: {
        crimeIndex: 'Low (24/100)',
        schoolRating: 9.1,
        walkScore: 68,
        rentGrowthYoY: 5.4,
        domMedian: 14,
      },
      investmentAnalytics: {
        capRate: 7.4,
        cocReturn: 14.2,
        irr5y: 16.8,
        breakevenOcc: 62,
        monthlyCashflow: 580,
      },
      tradesmen: [
        {
          name: 'Birmingham Home Solutions',
          service: 'General Building',
          rating: 4.9,
          eta: '1-2 days',
          phone: '+44-121-555-0345',
        },
        {
          name: 'Expert Roofers Ltd',
          service: 'Roofing Specialists',
          rating: 4.7,
          eta: '3-4 days',
          phone: '+44-121-555-0678',
        },
        {
          name: 'Precision Electricians',
          service: 'Electrical Work',
          rating: 4.8,
          eta: 'Same day',
          phone: '+44-121-555-0901',
        },
      ],
    },
  },
];

// Helper function to get demo property by slug
export function getDemoPropertyBySlug(slug: string): DemoProperty | undefined {
  return demoProperties.find((p) => p.slug === slug);
}

// Helper function to get demo property by id
export function getDemoPropertyById(id: string): DemoProperty | undefined {
  return demoProperties.find((p) => p.id === id);
}
