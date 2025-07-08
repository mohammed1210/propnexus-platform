import type { Property } from "./types";

const mockProperties: Property[] = [
  {
    id: "1",
    title: "Modern Family Home",
    price: 250000,
    location: "Liverpool",
    bedrooms: 3,
    bathrooms: 2,
    description: "A spacious family home with a large garden.",
    image: "/house1.jpg",
    yieldValue: 5.6,
    roi: 11.2,
    investmentType: "Buy to Let"
    latitude: 53.4084,
    longitude: -2.9916,
  },
  {
    id: "2",
    title: "City Apartment",
    price: 180000,
    location: "Newcastle upon Tyne",
    bedrooms: 2,
    bathrooms: 1,
    description: "A modern apartment in the heart of the city.",
    image: "/apartment1.jpg",
    yieldValue: 5.1,
    roi: 9.4,
    investmentType: "Buy to Let"
    latitude: 54.9783,
    longitude: -1.6178,
  },
  {
    id: "3",
    title: "Cosy Suburban House",
    price: 225000,
    location: "Sheffield",
    bedrooms: 3,
    bathrooms: 2,
    description: "A cosy house in a quiet suburb.",
    image: "/house2.jpg",
    yieldValue: 4.8,
    roi: 8.2,
    investmentType: "Buy to Let"
    latitude: 53.3811,
    longitude: -1.4701,
  },
];

export default mockProperties;
