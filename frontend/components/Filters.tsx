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
  investmentType: string;
  onInvestmentTypeChange: (value: string) => void;
}

export default function Filters({
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
}: FiltersProps) {
  return (
    <div className="space-y-2 mb-4">
      <input
        type="text"
        placeholder="Location"
        value={location}
        onChange={(e) => onLocationChange(e.target.value)}
        className="border rounded p-2 w-full md:w-auto"
      />
      <input
        type="number"
        placeholder="Bedrooms"
        value={bedrooms ?? ""}
        onChange={(e) => onBedroomsChange(e.target.value ? Number(e.target.value) : null)}
        className="border rounded p-2 w-full md:w-auto"
      />

      {/* Property Type Dropdown */}
      <select
        value={propertyType}
        onChange={(e) => onPropertyTypeChange(e.target.value)}
        className="border rounded p-2 w-full md:w-auto"
      >
        <option value="">All Property Types</option>
        <option value="House">House</option>
        <option value="Apartment">Apartment</option>
        <option value="HMO">HMO</option>
        <option value="Serviced Accommodation">Serviced Accommodation</option>
      </select>

      {/* Investment Type Dropdown */}
      <select
        value={investmentType}
        onChange={(e) => onInvestmentTypeChange(e.target.value)}
        className="border rounded p-2 w-full md:w-auto"
      >
        <option value="">All Investment Types</option>
        <option value="Buy Refurbish Refinance">Buy Refurbish Refinance</option>
        <option value="Buy to Let">Buy to Let</option>
        <option value="Flip">Flip</option>
        <option value="Lease Option Agreement">Lease Option Agreement</option>
        <option value="Rent to SA">Rent to SA</option>
      </select>
    </div>
  );
}
