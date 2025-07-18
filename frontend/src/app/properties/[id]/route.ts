// app/api/properties/[id]/route.ts
import { NextRequest } from 'next/server';

// Dummy dataset (replace this with DB fetch later)
const dummyProperties = [
  {
    id: '1',
    title: 'Modern Flat in London',
    location: 'London',
    price: 450000,
    imageurl: '/placeholder.jpg',
    description: 'A beautiful modern flat close to central London.',
    source: 'Rightmove',
    yield_percent: 5.1,
    roi_percent: 12.4,
    bedrooms: 2,
    bathrooms: 1,
    propertyType: 'Flat',
    investmentType: 'Buy to Let',
    latitude: 51.5074,
    longitude: -0.1278,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: '3-Bed HMO in Manchester',
    location: 'Manchester',
    price: 280000,
    imageurl: '/placeholder.jpg',
    description: 'High yield HMO in student area.',
    source: 'Zoopla',
    yield_percent: 8.5,
    roi_percent: 15.2,
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'House',
    investmentType: 'HMO',
    latitude: 53.4808,
    longitude: -2.2426,
    created_at: new Date().toISOString(),
  },
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const property = dummyProperties.find((p) => p.id === params.id);

  if (!property) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
    });
  }

  return new Response(JSON.stringify(property), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}