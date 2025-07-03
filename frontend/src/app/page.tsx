"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Property } from "./types"; // ✅ use shared type

const Map = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
        const data = await res.json();
        const dataWithAddress = data.map((p: any) => ({
          ...p,
          address: p.address || "",
        }));
        setProperties(dataWithAddress);
      } catch (error) {
        console.error("Error fetching properties:", error);
      }
    };

    fetchProperties();
  }, []);

  return (
    <main>
      <h1>Properties</h1>
      <Map properties={properties} />
      <ul>
        {properties.map((p) => (
          <li key={p.id}>
            {p.title} – {p.location} – £{p.price}
          </li>
        ))}
      </ul>
    </main>
  );
}
