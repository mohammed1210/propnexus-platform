import { useEffect, useState } from 'react';
import PropertyCard from "../../components/PropertyCard";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  imageurl: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetch('/api/properties') // Adjust if your API endpoint is different
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(err => console.error("Failed to fetch properties:", err));
  }, []);

  return (
    <div>
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          title={property.title}
          price={property.price}
          location={property.location}
          imageurl={property.imageurl}
        />
      ))}
    </div>
  );
}