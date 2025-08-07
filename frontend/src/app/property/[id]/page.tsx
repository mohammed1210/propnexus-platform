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

// === [1] MAIN COMPONENT ===
const PropertyDetailsPage = () => {
  const params = useParams() as { id: string };
  const id = params.id;
  const [property, setProperty] = useState<Property | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);

  // === [2] FETCH PROPERTY DATA ===
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/properties/${id}`);
        const data = await res.json();
        setProperty(data);
      } catch (err) {
        console.error('Error fetching property:', err);
      }
    };
    if (id && BACKEND_BASE_URL) fetchProperty();
  }, [id]);

  // === [3] GPT INVESTMENT SUMMARY ===
  useEffect(() => {
    const generateSummary = async () => {
      if (!property || !BACKEND_BASE_URL) return;
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property }),
        });
        const data = await res.json();
        setSummary(data.summary);
      } catch (err) {
        console.error('Error generating summary:', err);
      }
    };
    generateSummary();
  }, [property]);

  // === [4] GPT EXIT STRATEGIES ===
  useEffect(() => {
    const generateStrategies = async () => {
      if (!property || !BACKEND_BASE_URL) return;
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/generate-strategies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            price: property.price,
            roi_percent: property.roi_percent,
            yield_percent: property.yield_percent,
            location: property.location,
            property_type: property.propertyType,
            description: property.description,
          }),
        });
        const data = await res.json();
        setStrategies(data.strategies || []);
      } catch (err) {
        console.error('Error generating strategies:', err);
      }
    };
    generateStrategies();
  }, [property]);

  // === [5] SAVE DEAL TO FASTAPI BACKEND ===
  const handleSaveDeal = async () => {
    if (!property || !BACKEND_BASE_URL) return;
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/save-deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          title: property.title,
          location: property.location,
          price: property.price,
          yield_percent: property.yield_percent,
          roi_percent: property.roi_percent,
          saved_at: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      alert('✅ Deal saved successfully!');
    } catch (error) {
      console.error('Error saving deal:', error);
      alert('❌ Failed to save deal.');
    }
  };

  // === [6] DOWNLOAD DEAL PACK TO PDF ===
  const handleDownloadPDF = () => {
    if (!property) return;
    const element = document.getElementById('deal-pack');
    if (!element) return;
    html2pdf().set({ margin: 0.5, filename: `${property.title}_deal_pack.pdf` }).from(element).save();
  };

  // === [7] EXPORT TO CRM / COPY JSON ===
  const handleCopyJSON = () => {
    if (!property) return;
    navigator.clipboard.writeText(JSON.stringify(property, null, 2));
    alert('Property JSON copied to clipboard!');
  };

  // === [8] LOADING STATE ===
  if (!property) {
    return <div className="p-8 text-center text-gray-600 dark:text-gray-300">Loading property details...</div>;
  }

  // === [9] RENDER ===
  return (
    <div className="relative flex flex-col md:flex-row max-w-7xl mx-auto px-4 py-6">

      {/* === LEFT SIDE COLUMN === */}
      <div className="md:w-2/3 md:pr-6">

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{property.title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{property.location}</p>

        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt="Property"
          className="w-full h-80 object-cover rounded-md shadow-sm mb-4"
          onError={(e) => (e.target as HTMLImageElement).src = '/placeholder.jpg'}
        />

        {/* === GPT INVESTMENT SUMMARY === */}
        {summary && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">📘 GPT Investment Summary</h3>
            <p className="text-blue-700 dark:text-blue-100 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* === GPT EXIT STRATEGIES === */}
        {strategies.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">💼 GPT Exit Strategies</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {strategies.map((s, i) => (<li key={i}>{s}</li>))}
            </ul>
          </div>
        )}

        {/* === AI DEAL SCORE BARS === */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">🤖 AI Deal Score</h3>
          <div className="space-y-2">
            <div className="text-sm text-gray-600 dark:text-gray-300">ROI Strength</div>
            <div className="w-full bg-gray-300 rounded h-2">
              <div className="bg-green-500 h-2 rounded" style={{ width: `${property.roi_percent}%` }} />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Yield Potential</div>
            <div className="w-full bg-gray-300 rounded h-2">
              <div className="bg-blue-500 h-2 rounded" style={{ width: `${property.yield_percent}%` }} />
            </div>
          </div>
          <button onClick={() => setShowExplanation(true)} className="text-xs text-blue-600 mt-2 underline">
            What do these scores mean?
          </button>
          {showExplanation && (
            <div className="text-sm mt-2 text-gray-700 dark:text-gray-300">
              ROI and Yield scores are based on projected returns. Higher is better.
            </div>
          )}
        </div>

        {/* === COMPONENT MODULES === */}
        <InvestmentSummary property={property} />
        <ExitStrategyGenerator {...property} />

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <MortgageCalculator price={property.price} />
          <StampDutyCalculator price={property.price} />
        </div>

        {/* === AREA INTELLIGENCE === */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">📍 Area Intelligence</h3>
          <p className="text-gray-600 dark:text-gray-300">Avg. rental yield: 5.2% | Crime rate: Low | Transport: Good | Schools: Rated Good+</p>
        </div>

        {/* === NOTES FIELD === */}
        <NotesFields propertyId={id} />
      </div>

      {/* === RIGHT COLUMN: DEAL SUMMARY + MAP === */}
      <div className="md:w-1/3 md:pl-6 md:sticky md:top-4 mt-10 md:mt-0">
        <div id="deal-pack" className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📊 Deal Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-800 dark:text-gray-200">
            <div><p className="font-semibold">Price</p><p>£{property.price?.toLocaleString() || 'N/A'}</p></div>
            <div><p className="font-semibold">Yield</p><p>{property.yield_percent || 'N/A'}%</p></div>
            <div><p className="font-semibold">ROI</p><p>{property.roi_percent || 'N/A'}%</p></div>
            <div><p className="font-semibold">Type</p><p>{property.investmentType || 'N/A'}</p></div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button onClick={handleSaveDeal} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm">💾 Save Deal </button>
            <button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">📄 Download Deal Pack</button>
            <button onClick={handleCopyJSON} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm">🔗 Copy to CRM</button>
          </div>
        </div>

        {/* === MAP VIEW PINNED AT BOTTOM === */}
        <div className="h-72">
          <MapView properties={[property]} />
        </div>
      </div>

      {/* === FLOATING AI ASSISTANT === */}
      <AIChatbot />
    </div>
  );
};

export default PropertyDetailsPage;
