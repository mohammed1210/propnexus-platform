export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: 'Saved Deals • PropNexus',
  robots: { index: false, follow: false },
};

import React from "react";

import SavedDealsClient from "./SavedDealsClient";

export default function SavedDealsPage() {
  return <SavedDealsClient />;
}
