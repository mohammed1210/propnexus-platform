'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AIChatbot from '@details/AIChatbot';
import InvestmentSummary from '@details/InvestmentSummary';
import ExitStrategyGenerator from '@details/ExitStrategyGenerator';
import MortgageCalculator from '@details/MortgageCalculator';
import StampDutyCalculator from '@details/StampDutyCalculator';
import NotesFields from '@details/NotesFields';
import AreaIntel from '@details/AreaIntel';
import MapSingle from '@details/MapSingle';
import { Property } from '@/types';

export default function PropertyDetailsPage() {
  const params = useParams();
const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${id}`);
        const data = await res.json();
        setProperty(data);
      } catch (err) {
        console.error('Failed to fetch property:', err);
      }
    };
    fetchProperty();
  }, [id]);

  if (!property) return <div className="p-6 text-center text-gray-600">Loading property...</div>;

  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6">
      {/* ===== Left Column ===== */}
      <div className="md:w-2/3 md:pr-8">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-1">{property.title}</h1>
        <p className="text-gray-500 mb-3">{property.location}</p>
        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full h-64 object-cover rounded-lg mb-4"
        />

        {/* Investment Summary */}
        <div className="section-box">
          <InvestmentSummary property={property} />
        </div>

        {/* Exit Strategy */}
        <div className="section-box">
          <ExitStrategyGenerator
  title={property.title}
  location={property.location}
  price={property.price}
  yield_percent={property.yield_percent}
  roi_percent={property.roi_percent}
  propertyType={property.propertyType}
  investmentType={property.investmentType}
  description={property.description}
/>
        </div>

        {/* AI Deal Score */}
        <div className="section-box">
          <h2 className="text-lg font-semibold mb-1">🧠 AI Deal Score</h2>
          <div className="mb-2">
            <p><strong>ROI Strength</strong></p>
            <p><strong>Yield Potential</strong></p>
          </div>
          <button className="text-sm underline text-gray-500 mt-2">❓ What do these scores mean?</button>
        </div>

        {/* Mortgage Calculator */}
        <div className="section-box">
          <MortgageCalculator price={property.price} />
        </div>

        {/* Stamp Duty Calculator */}
        <div className="section-box">
          <StampDutyCalculator price={property.price} />
        </div>

        {/* Area Intelligence */}
        <div className="section-box">
          <AreaIntel property={property} />
        </div>

        {/* ===== [13] Investor Notes ===== */}
<div className="section-box">
  <NotesFields propertyId={id} />
  
{/* ===== Right Column ===== */}
<div className="md:w-1/3 md:pl-6 mt-8 md:mt-0 md:sticky md:top-4">
  {/* Deal Summary */}
  <div className="section-box">
    <h3 className="text-lg font-semibold mb-2">📊 Deal Summary</h3>
    <p><strong>Price:</strong> £{typeof property.price === 'number' ? property.price.toLocaleString() : 'N/A'}</p>
    <p><strong>Yield:</strong> {property.yield_percent ?? 'N/A'}%</p>
    <p><strong>ROI:</strong> {property.roi_percent ?? 'N/A'}%</p>
    <p><strong>Property Type:</strong> {property.propertyType || 'N/A'}</p>
    <p><strong>Investment Type:</strong> {property.investmentType || 'N/A'}</p>
    <p><strong>Source:</strong> {property.source || 'N/A'}</p>
  </div>

  {/* Save/Download/Share Buttons */}
  <div className="mt-4 flex flex-col gap-3">
    <button className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">💾 Save Deal</button>
    <button className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded">📄 Download Deal Pack</button>
    <button className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded">🔗 Copy to CRM</button>
  </div>

  {/* === [14] RIGHT COLUMN: Static Map === */}
      <div className="md:w-1/3 md:pl-6 md:sticky md:top-4 mt-8 md:mt-0">
        <MapView properties={[property]} />
  </div>
</div>

</div> {/* closes the main 2‑column row */}
<AIChatbot /> {/* Floating AI Assistant */}
</div> {/* closes #property-detail-page wrapper */}
);
      
}

export default PropertyDetailsPage;
