import PropertyCard from "../../components/PropertyCard";
import type { Property } from "./types"; // adjust path if needed

export default async function PropertiesPage() {
  const res = await fetch(
    "https://propnexus-backend-production.up.railway.app/properties",
    {
      next: { revalidate: 60 },
    }
  );

  const properties: Property[] = await res.json();

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Properties</h1>

      {/* ✅ Remove Filters block to fix build error */}
      {/* <Filters
        priceRange={[50000, 2000000]}
        onPriceChange={() => {}}
        yieldRange={[2, 15]}
        onYieldChange={() => {}}
        roiRange={[2, 20]}
        onRoiChange={() => {}}
        bedrooms={null}
        onBedroomsChange={() => {}}
        propertyType=""
        onPropertyTypeChange={() => {}}
        location=""
        onLocationChange={() => {}}
        investmentType=""
        onInvestmentTypeChange={() => {}}
      /> */}

      {properties.length === 0 ? (
        <p>No properties found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}