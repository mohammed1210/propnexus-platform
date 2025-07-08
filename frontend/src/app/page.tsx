"use client";

import { useEffect, useState } from "react";
import PropertyCard, { Property } from "@/components/PropertyCard";
import Filters from "@/components/Filters";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([50000, 2000000]);
  const [yieldRange, setYieldRange] = useState<[number, number]>([2, 15]);
  const [roiRange, setRoiRange] = useState<[number, number]>([2, 20]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    // Example mock data (replace with your real API call if needed)
    const fetchedProperties: Property[] = [
      {
        id: "1",
        title: "Modern Family Home",
        price: 250000,
        location: "Liverpool",
        bedrooms: 3,
        bathrooms: 2,
        description: "Spacious family home with garden",
        image: "/house1.jpg"
      },
      {
        id: "2",
        title: "City Apartment",
        price: 180000,
        location: "Newcastle upon Tyne",
        bedrooms: 2,
        bathrooms: 1,
        description: "Stylish city apartment close to amenities",
        image: "/apartment1.jpg"
      }
    ];

    setProperties(fetchedProperties);
  }, []);

  const filteredProperties = properties.filter(
    (property) =>
      property.price >= priceRange[0] &&
      property.price <= priceRange[1] &&
      property.yieldValue >= yieldRange[0] &&
      property.yieldValue <= yieldRange[1] &&
      property.roi >= roiRange[0] &&
      property.roi <= roiRange[1] &&
      (!bedrooms || property.bedrooms === bedrooms) &&
      (!propertyType || property.description.toLowerCase().includes(propertyType.toLowerCase())) &&
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