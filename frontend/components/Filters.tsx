"use client";
import React from "react";

interface FiltersProps {
  priceRange: [number, number];
  onPriceChange: (range: [number, number]) => void;
  yieldRange: [number, number];
  onYieldChange: (range: [number, number]) => void;
  roiRange: [number, number];
  onRoiChange: (range: [number, number]) => void;
  bedrooms: number | null;
  onBedroomsChange: (value: number | null) => void;
  propertyType: string;
  onPropertyTypeChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  priceRange,
  onPriceChange,
  yieldRange,
  onYieldChange,
  roiRange,
  onRoiChange,
  bedrooms,
  onBedroomsChange,
  propertyType,
  onPropertyTypeChange,
  location,
  onLocationChange,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="number"
          placeholder="Bedrooms"
          value={bedrooms ?? ""}
          onChange={(e) => onBedroomsChange(e.target.value ? parseInt(e.target.value) : null)}
          className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="text"
          placeholder="Property Type"
          value={propertyType}
          onChange={(e) => onPropertyTypeChange(e.target.value)}
          className="border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Max Price (£)</label>
          <input
            type="range"
            min={50000}
            max={2000000}
            value={priceRange[1]}
            onChange={(e) => onPriceChange([priceRange[0], parseInt(e.target.value)])}
            className="w-full"
          />
          <div className="text-sm mt-1">Up to £{priceRange[1].toLocaleString()}</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Yield %</label>
          <input
            type="range"
            min={2}
            max={15}
            value={yieldRange[1]}
            onChange={(e) => onYieldChange([yieldRange[0], parseInt(e.target.value)])}
            className="w-full"
          />
          <div className="text-sm mt-1">Up to {yieldRange[1]}%</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max ROI %</label>
          <input
            type="range"
            min={2}
            max={20}
            value={roiRange[1]}
            onChange={(e) => onRoiChange([roiRange[0], parseInt(e.target.value)])}
            className="w-full"
          />
          <div className="text-sm mt-1">Up to {roiRange[1]}%</div>
        </div>
      </div>
    </div>
  );
};

export default Filters;
