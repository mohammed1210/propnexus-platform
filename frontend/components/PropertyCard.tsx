export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
}

interface PropertyProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <img
        src={property.image || "/placeholder.jpg"}
        alt={property.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-1">{property.title}</h3>
        <p className="text-gray-500 text-sm mb-1">{property.location}</p>
        <p className="text-xl font-bold text-blue-700 mb-2">£{property.price.toLocaleString()}</p>
        <p className="text-gray-600 text-sm mb-1">
          {property.bedrooms} beds • {property.bathrooms} baths
        </p>
        <p className="text-gray-700 text-sm">{property.description}</p>
      </div>
    </div>
  );
}