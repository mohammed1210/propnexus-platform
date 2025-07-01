"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

const MapWithNoSSR = dynamic(() => import("./Map"), {
  ssr: false,
});

export default function Page() {
  return (
    <div>
      <h1>Properties</h1>
      <MapWithNoSSR />
    </div>
  );
}