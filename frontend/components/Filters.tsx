"use client";
import type { FC } from "react";

interface FiltersProps {
  priceRange: [number, number];
  onPriceChange: (range: [number, number]) => void;
  yieldRange: [number, number];
  onYieldChange: (range: [number, number]) => void;
  roiRange: [number, number];
  onRoiChange: (range: [number, number]) => void;
  bedrooms: number | null;
  onBedroomsChange: (bedrooms: number | null) => void;
  propertyType: string;
  onPropertyTypeChange: (type: string) => void;
  location: string;
  onLocationChange: (location: string) => void;
  investmentType: string;
  onInvestmentTypeChange: (type: string) => void;
}

const Filters: FC<FiltersProps> = ({
  price,
  onPriceChange,
  yieldValue,
  onYieldChange,
  roi,
  onRoiChange,
  bedrooms,
  onBedroomsChange,
  propertyType,
  onPropertyTypeChange,
  location,
  onLocationChange,
  investmentType,
  onInvestmentTypeChange,
}) => {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <input
        type="text"
        placeholder="Location"
        value={location}
        onChange={(e) => onLocationChange(e.target.value)}
        className="border p-2 rounded"
      />
      <input
        type="number"
        placeholder="Bedrooms"
        value={bedrooms ?? ""}
        onChange={(e) => onBedroomsChange(e.target.value ? parseInt(e.target.value) : null)}
        className="border p-2 rounded"
      />
      <select
        value={propertyType}
        onChange={(e) => onPropertyTypeChange(e.target.value)}
        className="border p-2 rounded"
      >
        <option value="">All Property Types</option>
        <option value="House">House</option>
        <option value="Apartment">Apartment</option>
        <option value="HMO">HMO</option>
        <option value="Serviced Accommodation">Serviced Accommodation</option>
      </select>
      <select
        value={investmentType}
        onChange={(e) => onInvestmentTypeChange(e.target.value)}
        className="border p-2 rounded"
      >
        <option value="">All Investment Types</option>
        <option value="Buy Refurbish Refinance">Buy Refurbish Refinance</option>
        <option value="Buy to Let">Buy to Let</option>
        <option value="Flip">Flip</option>
        <option value="Lease Option Agreement">Lease Option Agreement</option>
        <option value="Rent to SA">Rent to SA</option>
      </select>
      <label>
        Price: £{price.toLocaleString()}
        <input
          type="range"
          min="50000"
          max="2000000"
          value={price}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <label>
        Yield: {yieldValue}%
        <input
          type="range"
          min="2"
          max="15"
          value={yieldValue}
          onChange={(e) => onYieldChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <label>
        ROI: {roi}%
        <input
          type="range"
          min="2"
          max="20"
          value={roi}
          onChange={(e) => onRoiChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
    </div>
  );
};

export default Filters;
