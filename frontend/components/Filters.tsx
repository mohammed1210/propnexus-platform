import type { FC } from "react";

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
        onChange={(e) => onBedroomsChange(e.target.value ? Number(e.target.value) : null)}
      />
      <input
        type="text"
        placeholder="Property Type"
        className="border rounded p-2 w-full md:w-auto"
        value={propertyType}
        onChange={(e) => onPropertyTypeChange(e.target.value)}
      />
      <select
        className="border rounded p-2 w-full md:w-auto"
        value={investmentType}
        onChange={(e) => onInvestmentTypeChange(e.target.value)}
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
};

export default Filters;
