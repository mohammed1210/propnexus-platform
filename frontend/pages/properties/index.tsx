import { useState } from "react";

// Add above return:
const [minPrice, setMinPrice] = useState(0);
const [maxPrice, setMaxPrice] = useState(1000000);
const [minYield, setMinYield] = useState(0);
const [minRoi, setMinRoi] = useState(0);
const [locationFilter, setLocationFilter] = useState("");

// In your JSX, above the map and property list:
<div style={{ marginBottom: "20px" }}>
  <input
    type="number"
    placeholder="Min price"
    value={minPrice}
    onChange={(e) => setMinPrice(Number(e.target.value))}
    style={{ marginRight: "8px" }}
  />
  <input
    type="number"
    placeholder="Max price"
    value={maxPrice}
    onChange={(e) => setMaxPrice(Number(e.target.value))}
    style={{ marginRight: "8px" }}
  />
  <input
    type="number"
    placeholder="Min yield %"
    value={minYield}
    onChange={(e) => setMinYield(Number(e.target.value))}
    style={{ marginRight: "8px" }}
  />
  <input
    type="number"
    placeholder="Min ROI %"
    value={minRoi}
    onChange={(e) => setMinRoi(Number(e.target.value))}
    style={{ marginRight: "8px" }}
  />
  <input
    type="text"
    placeholder="Location (postcode)"
    value={locationFilter}
    onChange={(e) => setLocationFilter(e.target.value)}
  />
</div>
