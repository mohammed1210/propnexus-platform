"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Map = dynamic(() => import("./Map"), { ssr: false });

type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
};

export default function Page() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    fetch("https://propnexus-backend-production.up.railway.app/properties")
      .then((res) => res.json())
      .then((data) => setProperties(data))
      .catch((error) => console.error("Error fetching properties:", error));
  }, []);

  return (
    <main>
      <h1>Properties</h1>
      <Map properties={properties} />
      <ul>
        {properties.map((p) => (
          <li key={p.id}>
            {p.title} - {p.location} - £{p.price}
          </li>
        ))}
      </ul>
    </main>
  );
}
