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
  investmentType: string;
  onInvestmentTypeChange: React.Dispatch<React.SetStateAction<string>>;
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
        value={bedrooms || ""}
        onChange={(e) =>
          onBedroomsChange(Number(e.target.value) || null)
        }
      />
      <select
        className="border rounded p-2 w-full md:w-auto"
        value={propertyType}
        onChange={(e) => onPropertyTypeChange(e.target.value)}
      >
        <option value="">All Property Types</option>
        <option value="House">House</option>
        <option value="Apartment">Apartment</option>
        <option value="Studio">Studio</option>
      </select>

      <select
        className="border rounded p-2 w-full md:w-auto"
        value={investmentType}
        onChange={(e) => onInvestmentTypeChange(e.target.value)}
      >
        <option value="">All Investment Types</option>
        <option value="Buy Refurbish Refinance">Buy Refurbish Refinance</option>
        <option value="Buy to Let">Buy to Let (incl. HMO & SA)</option>
        <option value="Flip">Flip</option>
        <option value="Lease Option Agreement">Lease Option Agreement</option>
        <option value="Rent to SA">Rent to SA</option>
      </select>
    </div>
  );
}
