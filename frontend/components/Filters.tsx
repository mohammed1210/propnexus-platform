import React from "react";

interface FiltersProps {
  priceRange: [number, number];
  onPriceChange: React.Dispatch<React.SetStateAction<[number, number]>>;
  yieldRange: [number, number];
  onYieldChange: React.Dispatch<React.SetStateAction<[number, number]>>;
  roiRange: [number, number];
  onRoiChange: React.Dispatch<React.SetStateAction<[number, number]>>;
  bedrooms: number | null;
  onBedroomsChange: React.Dispatch<React.SetStateAction<number | null>>;
  propertyType: string;
  onPropertyTypeChange: React.Dispatch<React.SetStateAction<string>>;
  location: string;
  onLocationChange: React.Dispatch<React.SetStateAction<string>>;
}

export default function Filters(props: FiltersProps) {
  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Location"
          className="border rounded p-2 w-full"
          value={props.location}
          onChange={(e) => props.onLocationChange(e.target.value)}
        />
        <input
          type="number"
          placeholder="Bedrooms"
          className="border rounded p-2 w-full"
          value={props.bedrooms ?? ""}
          onChange={(e) => props.onBedroomsChange(Number(e.target.value) || null)}
        />
        <input
          type="text"
          placeholder="Property Type"
          className="border rounded p-2 w-full"
          value={props.propertyType}
          onChange={(e) => props.onPropertyTypeChange(e.target.value)}
        />
      </div>
      <div>
        <label>Max Price (£): Up to £{props.priceRange[1].toLocaleString()}</label>
        <input
          type="range"
          min={50000}
          max={2000000}
          value={props.priceRange[1]}
          onChange={(e) => props.onPriceChange([50000, Number(e.target.value)])}
          className="w-full"
        />
      </div>
      <div>
        <label>Max Yield %: Up to {props.yieldRange[1]}%</label>
        <input
          type="range"
          min={2}
          max={15}
          value={props.yieldRange[1]}
          onChange={(e) => props.onYieldChange([2, Number(e.target.value)])}
          className="w-full"
        />
      </div>
      <div>
        <label>Max ROI %: Up to {props.roiRange[1]}%</label>
        <input
          type="range"
          min={2}
          max={20}
          value={props.roiRange[1]}
          onChange={(e) => props.onRoiChange([2, Number(e.target.value)])}
          className="w-full"
        />
      </div>
    </div>
  );
}
