"use client";

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
    <div>
      {/* Add your filter sliders and inputs here */}
      <p>Filters component placeholder</p>
    </div>
  );
}
