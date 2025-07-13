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
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap gap-2">
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
          onChange={(e) =>
            onBedroomsChange(e.target.value ? parseInt(e.target.value) : null)
          }
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
      </div>

      {/* Sliders */}
      <div>
        <label>Price Range: £{priceRange[0].toLocaleString()} – £{priceRange[1].toLocaleString()}</label>
        <div className="flex gap-2">
          <input
            type="range"
            min={50000}
            max={2000000}
            step={5000}
            value={priceRange[0]}
            onChange={(e) => onPriceChange([Number(e.target.value), priceRange[1]])}
            className="w-full"
          />
          <input
            type="range"
            min={50000}
            max={2000000}
            step={5000}
            value={priceRange[1]}
            onChange={(e) => onPriceChange([priceRange[0], Number(e.target.value)])}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label>Yield Range: {yieldRange[0]}% – {yieldRange[1]}%</label>
        <div className="flex gap-2">
          <input
            type="range"
            min={2}
            max={15}
            step={0.5}
            value={yieldRange[0]}
            onChange={(e) => onYieldChange([Number(e.target.value), yieldRange[1]])}
            className="w-full"
          />
          <input
            type="range"
            min={2}
            max={15}
            step={0.5}
            value={yieldRange[1]}
            onChange={(e) => onYieldChange([yieldRange[0], Number(e.target.value)])}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label>ROI Range: {roiRange[0]}% – {roiRange[1]}%</label>
        <div className="flex gap-2">
          <input
            type="range"
            min={2}
            max={20}
            step={0.5}
            value={roiRange[0]}
            onChange={(e) => onRoiChange([Number(e.target.value), roiRange[1]])}
            className="w-full"
          />
          <input
            type="range"
            min={2}
            max={20}
            step={0.5}
            value={roiRange[1]}
            onChange={(e) => onRoiChange([roiRange[0], Number(e.target.value)])}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default Filters;
