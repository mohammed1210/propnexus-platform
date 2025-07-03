import React from "react";

interface PropertyCardProps {
  title: string;
  price: number;
  location: string;
  imageurl?: string;
  yield_percent?: number;
  roi_percent?: number;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  title,
  price,
  location,
  imageurl,
  yield_percent,
  roi_percent,
}) => {
  return (
    <div className="property-card" style={{ border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "6px" }}>
      {imageurl && <img src={imageurl} alt={title} style={{ width: "100%", borderRadius: "4px" }} />}
      <h3>{title}</h3>
      <p><strong>£{price.toLocaleString()}</strong></p>
      <p>{location}</p>
      {yield_percent !== undefined && <p>Yield: {yield_percent}%</p>}
      {roi_percent !== undefined && <p>ROI: {roi_percent}%</p>}
    </div>
  );
};

export default PropertyCard;
