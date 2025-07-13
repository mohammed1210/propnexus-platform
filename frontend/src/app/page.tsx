"use client";

import { useEffect, useState } from "react";
import PropertyCard from "@/components/PropertyCard";
import Filters from "@/components/Filters";
import MapView from "./Map"; // ✅ Correct import
import type { Property } from "./types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [price, setPrice] = useState<number>(500000);
  const [yieldValue, setYieldValue] = useState<number>(5);
  const [roiValue, setRoiValue] = useState<number>(8);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [investmentType, setInvestmentType] = useState<string>("");

  useEffect(() => {
    fetch("https://propnexus-backend-production.up.railway.app/properties")
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch((err) => console.error(err));
  }, []);

  // ✅ Define filteredProperties here
  const filteredProperties = properties.filter(
    (property) =>
      property.price <= price &&
      property.yield_percent >= yieldValue &&
      property.roi_percent >= roiValue &&
      (bedrooms === null || property.bedrooms === bedrooms) &&
      (propertyType === "" || property.propertyType?.toLowerCase().includes(propertyType.toLowerCase())) &&
      (investmentType === "" || property.investmentType?.toLowerCase() === investmentType.toLowerCase()) &&
      (location === "" || property.location.toLowerCase().includes(location.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Properties</h1>
      <Filters
        price={price}
        onPriceChange={setPrice}
        yieldValue={yieldValue}
        onYieldChange={setYieldValue}
        roiValue={roiValue}
        onRoiChange={setRoiValue}
        bedrooms={bedrooms}
        onBedroomsChange={setBedrooms}
        propertyType={propertyType}
        onPropertyTypeChange={setPropertyType}
        location={location}
        onLocationChange={setLocation}
        investmentType={investmentType}
        onInvestmentTypeChange={setInvestmentType}
      />
      <MapView properties={filteredProperties} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
