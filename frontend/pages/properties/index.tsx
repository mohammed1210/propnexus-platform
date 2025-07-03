import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PropertyCard from "../../components/PropertyCard"; // Adjust path if needed
import { Property } from "../../types"; // Adjust if your type file is different

const Map = dynamic(() => import("../../components/Map"), { ssr: false });

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [minYield, setMinYield] = useState(0);
  const [minRoi, setMinRoi] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    fetch("/api/properties") // ✅ Your backend endpoint URL
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch((err) => console.error("Failed to load properties", err));
  }, []);

  // ✅ Step 3 — Filtered properties
  const filteredProperties = properties.filter((p) => {
    return (
      p.price >= minPrice &&
      p.price <= maxPrice &&
      (p.yield_percent ?? 0) >= minYield &&
      (p.roi_percent ?? 0) >= minRoi &&
      (locationFilter === "" || p.location.toLowerCase().includes(locationFilter.toLowerCase()))
    );
  });

  return (
    <div>
      <h1>Properties</h1>

      {/* Example filters UI */}
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        />
        <input
          type="number"
          placeholder="Min Price"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="Min Yield"
          value={minYield}
          onChange={(e) => setMinYield(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="Min ROI"
          value={minRoi}
          onChange={(e) => setMinRoi(Number(e.target.value))}
        />
      </div>

      {/* ✅ Step 4 — Property cards */}
      <div>
        {filteredProperties.map((p) => (
          <PropertyCard
            key={p.id}
            title={p.title}
            price={p.price}
            location={p.location}
            imageurl={p.imageurl}
            yield_percent={p.yield_percent}
            roi_percent={p.roi_percent}
          />
        ))}
      </div>

      {/* ✅ Step 5 — Map with filtered markers */}
      <Map properties={filteredProperties} />
    </div>
  );
}
