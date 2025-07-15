"use client";

import dynamic from "next/dynamic";
import type { Property } from "./types";

// Dynamically import react-leaflet components only on client side
const DynamicLeafletMap = dynamic(() => import("./MapClient"), {
  ssr: false,
});

interface MapProps {
  properties: Property[];
}

export default function MapInner({ properties }: MapProps) {
  return <DynamicLeafletMap properties={properties} />;
}