"use client";

import { useEffect, useState } from "react";
import PropertyCard from "../../components/PropertyCard";
import Filters from "../../components/Filters";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  yieldValue: number;
  roi: number;
  image: string;
  propertyType: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([50000, 2000000]);
  const [yieldRange, setYieldRange] = useState<[number, number]>([2, 15]);
  const [roiRange, setRoiRange] = useState<[number, number]>([2, 20]);
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    params.append("minPrice", priceRange[0].toString());
    params.append("maxPrice", priceRange[1].toString());
    params.append("minYield", yieldRange[0].toString());
    params.append("maxYield", yieldRange[1].toString());
    params.append("minROI", roiRange[0].toString());
    params.append("maxROI", roiRange[1].toString());
    if (bedrooms !== null) params.append("bedrooms", bedrooms.toString());
    if (propertyType) params.append("propertyType", propertyType);
    if (location) params.append("location", location);

    fetch(`/api/properties?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch((err) => console.error(err));
  }, [priceRange, yieldRange, roiRange, bedrooms, propertyType, location]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
