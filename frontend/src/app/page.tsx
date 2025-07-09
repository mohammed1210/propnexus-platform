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
  const [propertyType, setPropertyType] = useState("");
  const [investmentType, setInvestmentType] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProperties(data);
      } catch (error) {
        console.error("Using mock properties as fallback:", error);
        setProperties(mockProperties);
      }
    };

    fetchProperties();
  }, []);

  const filteredProperties = properties.filter(
    (property) =>
      property.price >= priceRange[0] &&
      property.price <= priceRange[1] &&
      property.yield_percent >= yieldRange[0] &&
      property.yield_percent <= yieldRange[1] &&
      property.roi_percent >= roiRange[0] &&
      property.roi_percent <= roiRange[1] &&
      (!bedrooms || property.bedrooms === bedrooms) &&
      (!propertyType || property.propertyType?.toLowerCase().includes(propertyType.toLowerCase())) &&
      (!investmentType || property.investmentType?.toLowerCase().includes(investmentType.toLowerCase())) &&
      (!location || property.location.toLowerCase().includes(location.toLowerCase()))
  );

  return (
    <div className="container mx-auto px-4">
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
        investmentType={investmentType}
        onInvestmentTypeChange={setInvestmentType}
        location={location}
        onLocationChange={setLocation}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}