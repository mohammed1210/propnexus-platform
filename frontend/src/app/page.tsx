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


import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
});

export default function Page() {
  return (
    <div>
      <h1>Properties</h1>
      <Map />
    </div>
d1ea4cb (Final: Add map and page updates, package fixes, clean scraper)
  );
}
