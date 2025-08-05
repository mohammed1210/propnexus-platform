'use client';

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
const MapView = dynamic(() => import('@/app/MapView'), { ssr: false });

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const PropertyDetailsPage = () => {
  const params = useParams() as { id: string };
  const id = params.id;
  const [property, setProperty] = useState<Property | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(true);

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

  useEffect(() => {
    const generateSummary = async () => {
      if (!property || !BACKEND_BASE_URL) return;
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/generate-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property: {
              title: property.title,
              location: property.location,
              price: property.price,
              yield_percent: property.yield_percent,
              roi_percent: property.roi_percent,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              investmentType: property.investmentType,
              propertyType: property.propertyType,
            },
          }),
        });
        const data = await res.json();
        setSummary(data.summary);
      } catch (err) {
        console.error('Error generating summary:', err);
      }
    };
    generateSummary();
  }, [property]);

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

  if (!property) {
    return (
      <div className="p-8 text-center text-gray-600 dark:text-gray-300">
        Loading property details...
      </div>
    );
  }

  return (
    <div className="relative flex flex-col md:flex-row max-w-7xl mx-auto px-4 py-6">
      {/* Left Column */}
      <div className="md:w-2/3 md:pr-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{property.title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-2">{property.location}</p>

        <img
          src={property.imageurl || '/placeholder.jpg'}
          alt="Property"
          className="w-full h-80 object-cover rounded-md shadow-sm mb-4"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.jpg';
          }}
        />

        {/* Toggle for MapView */}
        <div className="mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={showMap}
              onChange={() => setShowMap(!showMap)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show Map View</span>
          </label>
        </div>

                {/* GPT Investment Summary */}
        {summary && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
              📘 GPT Investment Summary
            </h3>
            <p className="text-blue-700 dark:text-blue-100 whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        )}

        {/* GPT Exit Strategies */}
        {strategies.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              💼 GPT Exit Strategies
            </h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {strategies.map((strategy, i) => (
                <li key={i}>{strategy}</li>
              ))}
            </ul>
          </div>
        )}

        <InvestmentSummary property={property} />

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

        <MortgageCalculator price={property.price} />
        <StampDutyCalculator price={property.price} />

        {/* Area Intelligence */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            📍 Area Intelligence
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Avg. rental yield: 5.2% | Crime rate: Low | Transport: Good | Schools: Rated Good+
          </p>
        </div>

        <NotesFields propertyId={id} />
      </div>

      {/* Right Column — Static Map + Deal Summary */}
      <div className="md:w-1/3 md:pl-6 md:sticky md:top-4 mt-8 md:mt-0">
        {/* Deal Summary Box */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📊 Deal Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-800 dark:text-gray-200">
            <div>
              <p className="font-semibold">Price</p>
              <p>
                £
                {typeof property.price === 'number'
                  ? property.price.toLocaleString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="font-semibold">Yield</p>
              <p>
                {typeof property.yield_percent === 'number'
                  ? `${property.yield_percent}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="font-semibold">ROI</p>
              <p>
                {typeof property.roi_percent === 'number'
                  ? `${property.roi_percent}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="font-semibold">Type</p>
              <p>{property.investmentType || 'N/A'}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-4 flex flex-col gap-2">
            <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm">
              💾 Save Deal
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">
              📄 Download Deal Pack
            </button>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm">
              🔗 Copy Link
            </button>
          </div>
        </div>

        {/* Map View */}
        {showMap && (
          <div className="h-72">
            <MapView properties={[property]} />
          </div>
        )}
      </div>

      {/* AI Assistant Floating Modal */}
      <AIChatbot />
    </div>
  );
};

export default PropertyDetailsPage;
