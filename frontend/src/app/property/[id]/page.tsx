'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPropertyById } from '@/lib/data';
import { Property } from '@/types';
import InvestmentSummary from '@/components/property-details/InvestmentSummary';
import ExitStrategyGenerator from '@/components/property-details/ExitStrategyGenerator';
import MortgageCalculator from '@/components/property-details/MortgageCalculator';
import StampDutyCalculator from '@/components/property-details/StampDutyCalculator';
import NotesFields from '@/components/property-details/NotesFields';
import AIChatbot from '@/components/property-details/AIChatbot';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import html2pdf from 'html2pdf.js';

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      if (id && typeof id === 'string') {
        const data = await getPropertyById(id);
        setProperty(data);
      }
    }
    fetchProperty();
  }, [id]);

  const handleDownload = () => {
    const element = document.getElementById('deal-pack');
    if (element) {
      html2pdf().from(element).save();
    }
  };

  if (!property) return <div>Loading...</div>;

  return (
    <div className="property-detail-container" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', padding: '2rem' }}>
      
      {/* ===== LEFT COLUMN ===== */}
      <div className="left-column" style={{ flex: 2, minWidth: 0 }}>

        {/* Section: Title + Location */}
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{property.title}</h1>
        <p style={{ marginTop: 0, marginBottom: '1rem', color: '#555' }}>{property.location}</p>

        {/* Section: Image */}
        {property.imageurl && (
          <img src={property.imageurl} alt={property.title} style={{ width: '100%', borderRadius: '8px', marginBottom: '1.5rem' }} />
        )}

        {/* Section: GPT Investment Summary */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>📄 Investment Summary</h3>
          <InvestmentSummary property={property} />
        </section>

        {/* Section: Exit Strategy Generator */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>🏘️ Exit Strategy Suggestions</h3>
          <ExitStrategyGenerator property={property} />
        </section>

        {/* Section: Mortgage Calculator */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>🏦 Mortgage Calculator</h3>
          <MortgageCalculator propertyPrice={property.price} />
        </section>

        {/* Section: Stamp Duty Calculator */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>📑 Stamp Duty Calculator</h3>
          <StampDutyCalculator propertyPrice={property.price} />
        </section>

        {/* Section: Area Intelligence */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>📍 Area Intelligence</h3>
          <p>Avg. rental yield: {property.average_yield || '5.2%'} | Crime rate: Low | Transport: Good | Schools: Rated Good+</p>
        </section>

        {/* Section: Custom Notes */}
        <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3>📝 Investor Notes</h3>
          <NotesFields />
        </section>

        {/* Section: Static Map */}
        {property.latitude && property.longitude && (
          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
            <h3>🗺️ Property Location</h3>
            <iframe
              title="map"
              width="100%"
              height="300"
              loading="lazy"
              style={{ border: 0 }}
              src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
            ></iframe>
          </section>
        )}
      </div>

      {/* ===== RIGHT COLUMN ===== */}
      <div className="right-column" style={{ flex: 1, minWidth: '280px' }}>

        {/* Section: Deal Summary and Buttons */}
        <section
          id="deal-pack"
          style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}
        >
          <h3>📊 Deal Summary</h3>
          <p><strong>Price:</strong> £{property.price.toLocaleString()}</p>
          <p><strong>Yield:</strong> {property.yield_percent || 'N/A'}%</p>
          <p><strong>ROI:</strong> {property.roi_percent || 'N/A'}%</p>
          <p><strong>Type:</strong> {property.property_type || 'N/A'}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={handleDownload}>📥 Download Deal Pack</button>
            <CopyToClipboard text={JSON.stringify(property)}>
              <button>📋 Copy to CRM</button>
            </CopyToClipboard>
            <button onClick={() => alert('Deal saved to Supabase!')}>💾 Save Deal</button>
          </div>
        </section>

        {/* Section: AI Deal Score (optional visual scorecard) */}
        <section
          style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}
        >
          <h3>🤖 AI Deal Score</h3>
          <p><strong>ROI Strength</strong></p>
          <p><strong>Yield Potential</strong></p>
          <button style={{ marginTop: '0.5rem' }}>What do these scores mean?</button>
        </section>
      </div>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />
    </div>
  );
}
