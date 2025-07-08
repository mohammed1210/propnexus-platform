import type { NextApiRequest, NextApiResponse } from "next";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  yieldValue: number;
  roi: number;
  image: string;
  propertyType: string;
}

const mockProperties: Property[] = [
  {
    id: "1",
    title: "Modern Family Home",
    price: 250000,
    location: "Liverpool",
    bedrooms: 3,
    bathrooms: 2,
    yieldValue: 5.6,
    roi: 11.2,
    image: "/images/house1.jpg",
    propertyType: "Detached",
  },
  {
    id: "2",
    title: "City Apartment",
    price: 180000,
    location: "Newcastle upon Tyne",
    bedrooms: 2,
    bathrooms: 1,
    yieldValue: 5.1,
    roi: 9.4,
    image: "/images/house2.jpg",
    propertyType: "Apartment",
  },
  {
    id: "3",
    title: "Cosy Suburban House",
    price: 225000,
    location: "Sheffield",
    bedrooms: 3,
    bathrooms: 2,
    yieldValue: 4.8,
    roi: 8.2,
    image: "/images/house3.jpg",
    propertyType: "Semi-Detached",
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  let results = mockProperties;

  const {
    minPrice,
    maxPrice,
    minYield,
    maxYield,
    minROI,
    maxROI,
    bedrooms,
    propertyType,
    location,
  } = req.query;

  if (minPrice && maxPrice) {
    results = results.filter(
      (p) => p.price >= +minPrice && p.price <= +maxPrice
    );
  }

  if (minYield && maxYield) {
    results = results.filter(
      (p) => p.yieldValue >= +minYield && p.yieldValue <= +maxYield
    );
  }

  if (minROI && maxROI) {
    results = results.filter((p) => p.roi >= +minROI && p.roi <= +maxROI);
  }

  if (bedrooms) {
    results = results.filter((p) => p.bedrooms === +bedrooms);
  }

  if (propertyType) {
    results = results.filter((p) =>
      p.propertyType.toLowerCase().includes((propertyType as string).toLowerCase())
    );
  }

  if (location) {
    results = results.filter((p) =>
      p.location.toLowerCase().includes((location as string).toLowerCase())
    );
  }

  res.status(200).json(results);
}
