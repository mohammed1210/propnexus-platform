"use client";
import { useEffect, useState } from "react";
import PropertyCard from "@/components/PropertyCard";
import Filters from "@/components/Filters";
import type { Property } from "./types";
import mockProperties from "./mockProperties";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([50000, 2000000]);
  const [yieldRange, setYieldRange] = useState<[number, number]>([2, 15]);
  const [roiRange, setRoiRange] = useState<[number, number]>([2, 20]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>("");
  const [location, setLocation] = useState<string>("");

  useEffect(() => {
    // Use API or mock
    setProperties(mockProperties);
  }, []);

  const filteredProperties = properties.filter(
    (property) =>
      property.price >= priceRange[0] &&
      property.price <= priceRange[1] &&
      property.yieldValue >= yieldRange[0] &&
      property.yieldValue <= yieldRange[1] &&
      property.roi >= roiRange[0] &&
      property.roi <= roiRange[1] &&
      (bedrooms === null || property.bedrooms === bedrooms) &&
      (propertyType === "" || property.title.includes(propertyType)) &&
      (location === "" || property.location.toLowerCase().includes(location.toLowerCase()))
  );

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
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
