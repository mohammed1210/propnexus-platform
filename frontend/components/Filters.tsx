"use client";

interface FiltersProps {
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  yieldRange: [number, number];
  setYieldRange: (range: [number, number]) => void;
  roiRange: [number, number];
  setRoiRange: (range: [number, number]) => void;
  bedrooms: number | null;
  setBedrooms: (beds: number | null) => void;
  propertyType: string;
  setPropertyType: (type: string) => void;
  location: string;
  setLocation: (loc: string) => void;
}

export default function Filters(props: FiltersProps) {
  return (
    <div>
      {/* Add your filter sliders and inputs here */}
      <p>Filters component placeholder</p>
    </div>
  );
}
