import React from "react";

interface PropertyCardProps {
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  yieldValue: number;
  roi: number;
  image: string;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  title,
  price,
  location,
  bedrooms,
  bathrooms,
  yieldValue,
  roi,
  image,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition hover:shadow-lg">
      <img src={image} alt={title} className="w-full h-48 object-cover" />
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-gray-500 mb-2">{location}</p>
        <p className="text-primary-600 font-bold text-xl mb-2">£{price.toLocaleString()}</p>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{bedrooms} 🛏️</span>
          <span>{bathrooms} 🛁</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Yield: {yieldValue}%</span>
          <span>ROI: {roi}%</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
