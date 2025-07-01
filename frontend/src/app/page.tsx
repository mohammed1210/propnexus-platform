"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Map = dynamic(() => import("./Map"), { ssr: false });

export default function Page() {
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    const fetchProperties = async () => {
      const res = await fetch("https://propnexus-backend-production.up.railway.app/properties");
      const data = await res.json();
      setProperties(data);
    };
    fetchProperties();
  }, []);

  return (
    <div>
      <h1>Properties</h1>
      <Map properties={properties} />
    </div>
  );
}
