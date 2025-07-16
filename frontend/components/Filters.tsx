"use client";

interface FiltersProps {
  minPrice: number;
  maxPrice: number;
  setMinPrice: (value: number) => void;
  setMaxPrice: (value: number) => void;
}

export default function Filters({ minPrice, maxPrice, setMinPrice, setMaxPrice }: FiltersProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "15px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
        marginBottom: "20px",
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <label>
        Min Price:
        <input
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(Number(e.target.value))}
          style={{
            marginLeft: "5px",
            padding: "6px",
            border: "1px solid #e5e7eb",
            borderRadius: "5px",
          }}
        />
      </label>
      <label>
        Max Price:
        <input
          type="number"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          style={{
            marginLeft: "5px",
            padding: "6px",
            border: "1px solid #e5e7eb",
            borderRadius: "5px",
          }}
        />
      </label>
    </div>
  );
}
