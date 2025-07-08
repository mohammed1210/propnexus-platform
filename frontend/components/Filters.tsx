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

export default function Filters(props: FiltersProps) {
  const {
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
  } = props;

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-4 mb-4">
      <input
        type="text"
        placeholder="Location"
        className="border rounded p-2 w-full md:w-auto"
        value={location}
        onChange={(e) => onLocationChange(e.target.value)}
      />
      <input
        type="number"
        placeholder="Bedrooms"
        className="border rounded p-2 w-full md:w-auto"
        value={bedrooms ?? ""}
        onChange={(e) => onBedroomsChange(Number(e.target.value) || null)}
      />
      <select
        className="border rounded p-2 w-full md:w-auto"
        value={propertyType}
        onChange={(e) => onPropertyTypeChange(e.target.value)}
      >
        <option value="">All Types</option>
        <option value="House">House</option>
        <option value="Apartment">Apartment</option>
        <option value="Studio">Studio</option>
      </select>
    </div>
  );
}
