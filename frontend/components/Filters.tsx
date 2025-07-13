import React from "react";

interface FiltersProps {
  price: number;
  onPriceChange: (value: number) => void;
  yieldValue: number;
  onYieldChange: (value: number) => void;
  roiValue: number;
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

const Filters: React.FC<FiltersProps> = ({
  price,
  onPriceChange,
  yieldValue,
  onYieldChange,
  roiValue,
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
    <div className="bg-white p-4 rounded shadow mb-6">
      <div className="mb-4">
        <label>Price (£): {price.toLocaleString()}</label>
        <input
          type="range"
          min={50000}
          max={2000000}
          step={10000}
          value={price}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label>Yield (%): {yieldValue}</label>
        <input
          type="range"
          min={2}
          max={15}
          step={0.1}
          value={yieldValue}
          onChange={(e) => onYieldChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label>ROI (%): {roiValue}</label>
        <input
          type="range"
          min={2}
          max={20}
          step={0.1}
          value={roiValue}
          onChange={(e) => onRoiChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label>Bedrooms:</label>
        <input
          type="number"
          value={bedrooms ?? ""}
          onChange={(e) => onBedroomsChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full border p-1"
          placeholder="Any"
        />
      </div>

      <div className="mb-4">
        <label>Property Type:</label>
        <input
          type="text"
          value={propertyType}
          onChange={(e) => onPropertyTypeChange(e.target.value)}
          className="w-full border p-1"
          placeholder="e.g. Detached, Flat"
        />
      </div>

      <div className="mb-4">
        <label>Location:</label>
        <input
          type="text"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="w-full border p-1"
          placeholder="e.g. London"
        />
      </div>

      <div className="mb-4">
        <label>Investment Type:</label>
        <input
          type="text"
          value={investmentType}
          onChange={(e) => onInvestmentTypeChange(e.target.value)}
          className="w-full border p-1"
          placeholder="e.g. BTL, Flip"
        />
      </div>
    </div>
  );
};

export default Filters;
