"use client";

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
  investmentType: string;
  onInvestmentTypeChange: (type: string) => void;
  location: string;
  onLocationChange: (location: string) => void;
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
  investmentType,
  onInvestmentTypeChange,
  location,
  onLocationChange,
}: FiltersProps) {
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
        onChange={(e) => onBedroomsChange(e.target.value ? parseInt(e.target.value) : null)}
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

      {/* Future: Add sliders for priceRange, yieldRange, roiRange, or advanced filter UI here */}
    </div>
  );
}