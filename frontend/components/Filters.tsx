"use client";
import type { FC } from "react";

interface FiltersProps {
  priceRange: number;
  onPriceChange: (value: number) => void;
  yieldRange: number;
  onYieldChange: (value: number) => void;
  roiRange: number;
  onRoiChange: (value: number) => void;
  bedrooms: number | null;
  onBedroomsChange: (value: number | null) => void;
  propertyType: string;
  onPropertyTypeChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  investmentType: string;
  onInvestmentTypeChange: (value: string) => void;
}

const Filters: FC<FiltersProps> = ({
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
  investmentType,
  onInvestmentTypeChange,
}) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
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
        onChange={(e) => onBedroomsChange(e.target.value ? Number(e.target.value) : null)}
        className="border p-2 rounded w-24"
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
        Price (£): {priceRange.toLocaleString()}
        <input
          type="range"
          min={50000}
          max={2000000}
          value={priceRange}
          onChange={(e) => onPriceChange(Number(e.target.value))}
        />
      </label>
      <label>
        Yield (%): {yieldRange}
        <input
          type="range"
          min={2}
          max={20}
          value={yieldRange}
          onChange={(e) => onYieldChange(Number(e.target.value))}
        />
      </label>
      <label>
        ROI (%): {roiRange}
        <input
          type="range"
          min={2}
          max={20}
          value={roiRange}
          onChange={(e) => onRoiChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
};

export default Filters;
