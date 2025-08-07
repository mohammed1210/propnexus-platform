'use client';

// === [0] IMPORTS ===
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Property } from '@/types';
import InvestmentSummary from '@details/InvestmentSummary';
import ExitStrategyGenerator from '@details/ExitStrategyGenerator';
import MortgageCalculator from '@details/MortgageCalculator';
import StampDutyCalculator from '@details/StampDutyCalculator';
import NotesFields from '@details/NotesFields';
import AIChatbot from '@details/AIChatbot';
import dynamic from 'next/dynamic';
import html2pdf from 'html2pdf.js';

const MapView = dynamic(() => import('@/app/MapView'), { ssr: false });
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PropertyDetailsPage() {
  const params = useParams()
  const [property, setProperty] = useState<Property | null>(null)

  // ===== Fetch Property Data =====
  useEffect(() => {
    const fetchProperty = async () => {
      const id = params.id
      const res = await fetch(`/api/properties/${id}`)
      const data = await res.json()
      setProperty(data)
    }
    fetchProperty()
  }, [params.id])

  if (!property) return <div>Loading...</div>

  return (
    <div className="property-detail-page" style={{ padding: '2rem' }}>
      {/* ===== Title and Header Row ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h1>{property.title}</h1>
          <p style={{ color: '#666' }}>{property.location}</p>
          {property.imageurl && (
            <img
              src={property.imageurl}
              alt={property.title}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', marginTop: '1rem' }}
            />
          )}
        </div>

        {/* ===== Sidebar Buttons & Summary ===== */}
        <div style={{ flex: 1, minWidth: '280px', paddingLeft: '2rem' }}>
          <div style={{ background: '#f9f9f9', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
            <h3>📊 Deal Summary</h3>
            <p><strong>Price:</strong> £{property.price.toLocaleString()}</p>
            <p><strong>Yield:</strong> {property.yield_percent}%</p>
            <p><strong>ROI:</strong> {property.roi_percent}%</p>
            <p><strong>Type:</strong> {property.investment_type || 'N/A'}</p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button className="button-primary"><FaSave /> Save Deal</button>
              <button className="button-secondary"><FaDownload /> Download Deal Pack</button>
              <button className="button-tertiary"><FaCopy /> Copy to CRM</button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== GPT Investment Summary ===== */}
      <div style={{ marginTop: '2rem' }}>
        <InvestmentSummary property={property} />
      </div>

      {/* ===== Exit Strategy Generator ===== */}
      <div style={{ marginTop: '2rem' }}>
        <ExitStrategyGenerator property={property} />
      </div>

      {/* ===== AI Deal Score Breakdown ===== */}
      <div style={{ marginTop: '2rem' }}>
        <h3>🤖 AI Deal Score</h3>
        <p><strong>ROI Strength</strong></p>
        <p><strong>Yield Potential</strong></p>
        <button className="button-tertiary" style={{ marginTop: '0.5rem' }}>What do these scores mean?</button>
      </div>

      {/* ===== Mortgage Calculator ===== */}
      <div style={{ marginTop: '2rem' }}>
        <MortgageCalculator price={property.price} />
      </div>

      {/* ===== Stamp Duty Calculator ===== */}
      <div style={{ marginTop: '2rem' }}>
        <StampDutyCalculator price={property.price} />
      </div>

      {/* ===== Area Intelligence Block ===== */}
      <div style={{ marginTop: '2rem' }}>
        <h3>📍 Area Intelligence</h3>
        <p><strong>Avg. rental yield:</strong> 5.2%</p>
        <p><strong>Crime rate:</strong> Low</p>
        <p><strong>Transport:</strong> Good</p>
        <p><strong>Schools:</strong> Rated Good+</p>
      </div>

      {/* ===== Notes Fields ===== */}
      <div style={{ marginTop: '2rem' }}>
        <NotesFields />
      </div>

      {/* ===== Static Map View (Bottom) ===== */}
      {property.latitude && property.longitude && (
        <div style={{ marginTop: '2rem' }}>
          <h3>🗺️ Location</h3>
          <div style={{ height: '400px' }}>
            <MapView properties={[property]} />
          </div>
        </div>
      )}

      {/* ===== Floating AI Chatbot ===== */}
      <AIChatbot property={property} />
    </div>
  )
}
