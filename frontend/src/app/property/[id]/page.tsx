'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);

        const useBackend = Boolean(BACKEND_BASE && BACKEND_BASE.startsWith('http'));
        const url = useBackend ? `${BACKEND_BASE}/api/properties/${id}` : `/api/properties/${id}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();

        const p: Property = {
          ...raw,
          price: Number(raw.price ?? 0),
          yield_percent: Number(raw.yield_percent ?? raw.yield ?? 0),
          roi_percent: Number(raw.roi_percent ?? raw.roi ?? 0),
          latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
          longitude: raw.longitude != null ? Number(raw.longitude) : undefined,
          propertyType: raw.propertyType ?? raw.property_type ?? '',
          investmentType: raw.investmentType ?? raw.investment_type ?? '',
        };

        setProperty(p);
      } catch (err: any) {
        console.error('Failed to fetch property:', err);
        setError('Sorry — we couldn’t load this property.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, BACKEND_BASE]);

  const hasCoords = useMemo(
    () => Boolean(property?.latitude != null && property?.longitude != null),
    [property?.latitude, property?.longitude]
  );

  if (loading) {
    return (
      <div className="px-4 md:px-12 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-2/3 bg-slate-200 rounded" />
          <div className="h-4 w-1/3 bg-slate-200 rounded" />
          <div className="h-64 w-full bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6 text-center text-red-600">
        {error ?? 'Property not found.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row px-4 md:px-12 py-6">
      {/* ===== Left Column ===== */}
      <div className="md:w-2/3 md:pr-8">
        {/* Title / Image */}
        <h1 className="text-2xl font-bold mb-1">{property.title}</h1>
        <p className="text-gray-500 mb-3">{property.location}</p>

        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt={property.title}
          className="w-full h-64 object-cover rounded-lg mb-4"
          onError={(e) => ((e.target as HTMLImageElement).src = '/placeholder.jpg')}
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
          <button className="text-sm underline text-gray-500 mt-2" aria-label="Learn more about scores">
            ❓ What do these scores mean?
          </button>
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

        {/* Investor Notes */}
        <div className="section-box">
          <NotesFields propertyId={id ?? ''} />
        </div>
      </div>

      {/* ===== Right Column ===== */}
      <aside className="md:w-1/3 md:pl-6 mt-8 md:mt-0 md:sticky md:top-4">
        {/* Deal Summary */}
        <div className="section-box">
          <h3 className="text-lg font-semibold mb-2">📊 Deal Summary</h3>
          <p>
            <strong>Price:</strong>{' '}
            £{typeof property.price === 'number' ? property.price.toLocaleString() : 'N/A'}
          </p>
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

        {/* Static Map */}
        {hasCoords ? (
          <div className="mt-8">
            <MapSingle property={property} />
          </div>
        ) : (
          <p className="mt-8 text-gray-500">Map unavailable — no coordinates provided.</p>
        )}
      </aside>

      {/* Floating AI Assistant */}
      <AIChatbot property={property} />
    </div>
  );
}
