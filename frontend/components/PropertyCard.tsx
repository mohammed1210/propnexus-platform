import React from "react";

export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
}

export default function PropertyCard({
  title,
  price,
  location,
  yieldValue,
  roi,
  bedrooms,
  image,
}: PropertyProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <img src={image} alt={title} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-gray-500 text-sm mb-2">{location}</p>
        <p className="text-xl font-bold text-primary-700 mb-2">£{price.toLocaleString()}</p>
        <div className="flex justify-between text-sm mb-2">
          <span>Yield: {yieldValue}%</span>
          <span>ROI: {roi}%</span>
        </div>
        <p className="text-gray-600 text-sm mb-3">{bedrooms} bedrooms</p>
        <div className="flex gap-2">
          <button className="flex-1 bg-primary-600 text-white py-1 rounded hover:bg-primary-700 transition">
            Save Deal
          </button>
          <button className="flex-1 border border-primary-600 text-primary-600 py-1 rounded hover:bg-primary-50 transition">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
