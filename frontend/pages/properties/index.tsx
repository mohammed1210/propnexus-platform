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
    fetch('/api/properties') // update to your actual backend API endpoint if needed
      .then(res => res.json())
      .then(data => setProperties(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h1>Properties</h1>
      <div>
        {properties.map((property) => (
          <Propertycard
            key={property.id}
            title={property.title}
            price={property.price}
            location={property.location}
            imageurl={property.imageurl}
          />
        ))}
      </div>
    </div>
  );
}
