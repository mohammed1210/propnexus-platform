import React from "react";

interface FiltersProps {
  price: number;
  onPriceChange: (value: number) => void;
  yieldValue: number;
  onYieldChange: (value: number) => void;
  roiValue: number;
  onRoiChange: (value: number) => void;
}

const Filters: React.FC<FiltersProps> = ({
  price,
  onPriceChange,
  yieldValue,
  onYieldChange,
  roiValue,
  onRoiChange,
}) => {
  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <div className="mb-4">
        <label>Price (£): {price.toLocaleString()}</label>
        <input
          type="range"
          min={50000}
          max={2000000}
          step={10000}
          value={price}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label>Yield (%): {yieldValue}</label>
        <input
          type="range"
          min={2}
          max={15}
          step={0.1}
          value={yieldValue}
          onChange={(e) => onYieldChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label>ROI (%): {roiValue}</label>
        <input
          type="range"
          min={2}
          max={20}
          step={0.1}
          value={roiValue}
          onChange={(e) => onRoiChange(Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default Filters;
