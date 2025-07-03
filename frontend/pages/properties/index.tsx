import { useEffect, useState } from 'react';
import Propertycard from "../../components/Propertycard";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  imageurl?: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch('/api/properties'); // Adjust if your API endpoint is different
        const data = await res.json();
        setProperties(data);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };

    fetchProperties();
  }, []);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '20px' }}>
      {properties.length === 0 ? (
        <p>Loading properties...</p>
      ) : (
        properties.map((property) => (
          <PropertyCard
            key={property.id}
            title={property.title}
            price={property.price}
            location={property.location}
            imageurl={property.imageurl}
          />
        ))
      )}
    </div>
  );
}
