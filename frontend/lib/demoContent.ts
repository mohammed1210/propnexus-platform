export type DemoSampleProperty = {
  id: string;
  title: string;
  location: string;
  postcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  yield_percent: number;
  roi_percent: number;
  score: number;
  imageurl: string;
  source: string;
};

export const DEMO_SAMPLE_PROPERTIES: DemoSampleProperty[] = [
  {
    id: '57d1a817-17fa-461a-bde5-3bad8843e349',
    title: 'Gobions Avenue, Romford, RM5 5 bed house for sale - £550,000',
    location: 'Romford',
    postcode: 'RM5',
    price: 550000,
    bedrooms: 5,
    bathrooms: 3,
    yield_percent: 6.7,
    roi_percent: 3.21,
    score: 73,
    imageurl: 'https://media.onthemarket.com/properties/18923261/1598197643/image-0-1024x1024.webp',
    source: 'OnTheMarket',
  },
  {
    id: 'e8bbfcd6-d562-4b69-be2c-d44533e30689',
    title: 'Kenyon Lane, Manchester M40 2 bed flat for sale - £95,000',
    location: 'Manchester',
    postcode: 'M40',
    price: 95000,
    bedrooms: 2,
    bathrooms: 1,
    yield_percent: 5.8,
    roi_percent: 0.8,
    score: 68,
    imageurl: 'https://media.onthemarket.com/properties/18422309/1585881659/image-0-1024x1024.webp',
    source: 'OnTheMarket',
  },
  {
    id: 'd858d635-6fdd-4c82-bfef-1f2cacb945f0',
    title: '213 Percy Road, Sparkhill, B11 3LB 2 bed terraced house for sale - £200,000',
    location: 'Birmingham',
    postcode: 'B11',
    price: 200000,
    bedrooms: 2,
    bathrooms: 1,
    yield_percent: 5.8,
    roi_percent: 0.8,
    score: 68,
    imageurl: 'https://media.onthemarket.com/properties/17721274/1562381844/image-0-1024x1024.webp',
    source: 'OnTheMarket',
  },
];

export const DEMO_PREMIUM_SCREENSHOT_PROPERTY_ID =
  '57d1a817-17fa-461a-bde5-3bad8843e349';

export const DEMO_PREMIUM_FEATURES = [
  {
    src: '/images/demo/screenshots/premium-analytics.png',
    alt: 'Investment analytics section from a real PropNexus property detail page',
    title: 'Investment Analytics',
    description:
      'Live investment summary and calculator views captured from a working property detail page.',
  },
  {
    src: '/images/demo/screenshots/premium-tradesmen.png',
    alt: 'Local tradesmen and services section from a real PropNexus property detail page',
    title: 'Tradesmen Services',
    description:
      'Nearby builders, plumbers, electricians, roofers, and surveyors shown against live property coordinates.',
  },
  {
    src: '/images/demo/screenshots/premium-ai-score.png',
    alt: 'AI deal score section from a real PropNexus property detail page',
    title: 'AI Deal Score',
    description:
      'Stored score breakdown, category bars, and scoring version metadata from a real listing record.',
  },
  {
    src: '/images/demo/screenshots/premium-area-intel.png',
    alt: 'Area insights section from a real PropNexus property detail page',
    title: 'Area Intel',
    description:
      'Live postcode intelligence including rent, yield, average price, crime, and schools data.',
  },
];
