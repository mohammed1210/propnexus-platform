import type { NextApiRequest, NextApiResponse } from 'next';

const mockProperties = [
  {
    id: '1',
    title: 'Modern Family Home',
    price: 250000,
    location: 'Liverpool',
    bedrooms: 3,
    bathrooms: 2,
    description: 'A spacious family home with a large garden.',
    imageurl: '/house1.jpg',
    yield_percent: 5.6,
    roi_percent: 11.2,
    property_type: 'House',
  },
  {
    id: '2',
    title: 'City Apartment',
    price: 180000,
    location: 'Newcastle upon Tyne',
    bedrooms: 2,
    bathrooms: 1,
    description: 'A modern apartment in the heart of the city.',
    imageurl: '/apartment1.jpg',
    yield_percent: 5.1,
    roi_percent: 9.4,
    property_type: 'Apartment',
  },
  {
    id: '3',
    title: 'Cosy Suburban House',
    price: 225000,
    location: 'Sheffield',
    bedrooms: 3,
    bathrooms: 2,
    description: 'A cosy house in a quiet suburb.',
    imageurl: '/house2.jpg',
    yield_percent: 4.8,
    roi_percent: 8.2,
    property_type: 'House',
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(mockProperties);
}
