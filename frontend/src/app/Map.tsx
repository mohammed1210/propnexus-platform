"use client";

import dynamic from "next/dynamic";

// Dynamically import MapInner and disable SSR
const MapInner = dynamic(() => import("./MapInner"), { ssr: false });

export default MapInner;