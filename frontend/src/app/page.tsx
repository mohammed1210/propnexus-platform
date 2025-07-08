import { mockProperties } from "./mockProperties";

"use client";
import { useEffect, useState } from "react";
import PropertyCard from "@/components/PropertyCard";
import Filters from "@/components/Filters";
import { Property } from "./types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([50000, 2000000]);
  const [yieldRange, setYieldRange] = useState<[number, number]>([2, 15]);
  const [roiRange, setRoiRange] = useState<[number, number]>([2, 20]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  "use client";
import { useEffect, useState } from "react";
import PropertyCard from "@/components/PropertyCard";
import Filters from "@/components/Filters";
import { Property } from "./types";
import { mockProperties } from "./mockProperties"; // <-- add this

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([50000, 2000000]);
  const [yieldRange, setYieldRange] = useState<[number, number]>([2, 15]);
  const [roiRange, setRoiRange] = useState<[number, number]>([2, 20]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  useEffect(() => {
    setProperties(mockProperties);
  }, []);

  // ...rest of your component code
}

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Properties</h1>
      <Filters
        priceRange={priceRange}
        onPriceChange={setPriceRange}
        yieldRange={yieldRange}
        onYieldChange={setYieldRange}
        roiRange={roiRange}
        onRoiChange={setRoiRange}
        bedrooms={bedrooms}
        onBedroomsChange={setBedrooms}
        propertyType={propertyType}
        onPropertyTypeChange={setPropertyType}
        location={location}
        onLocationChange={setLocation}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            title={property.title}
            price={property.price}
            location={property.location}
            bedrooms={property.bedrooms}
            yieldValue={property.yieldValue}
            roi={property.roi}
            image={property.image}
          />
        ))}
      </div>
    </div>
  );
}
