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

const PropertyDetailsPage = () => {
  const params = useParams() as { id: string };
  const id = params.id;
  const [property, setProperty] = useState<Property | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  // 🔹 Step 1: Fetch Property by ID
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${id}`);
        const data = await res.json();
        setProperty(data);
        console.log('✅ Property loaded:', data);
      } catch (err) {
        console.error('❌ Error fetching property:', err);
      }
    };

    if (id) fetchProperty();
  }, [id]);

  // 🔹 Step 2: Generate GPT Summary after property is loaded
  useEffect(() => {
    const generateSummary = async () => {
      if (!property) return;

      try {
        const res = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: property.title,
            location: property.location,
            price: property.price,
            yield_percent: property.yield_percent,
            roi_percent: property.roi_percent,
            investmentType: property.investmentType,
            propertyType: property.propertyType,
          }),
        });

        const data = await res.json();
        setSummary(data.summary);
        console.log('🧠 GPT Summary:', data.summary);
      } catch (err) {
        console.error('❌ Error generating summary:', err);
      }
    };

    generateSummary();
  }, [property]);

  if (!property) {
    return (
      <div className="p-8 text-center text-gray-600 dark:text-gray-300">
        Loading property details...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* 🔹 Title & Location */}
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{property.title}</h1>
      <p className="text-gray-500 dark:text-gray-300 mb-4">{property.location}</p>

      {/* 🔹 Property Image */}
      <img
        src={property.imageurl || '/placeholder.jpg'}
        alt="Property"
        className="w-full h-96 object-cover rounded-lg shadow-md mb-6"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/placeholder.jpg';
        }}
      />

      {/* 🔹 GPT Investment Summary */}
      {summary && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">📘 GPT Investment Summary</h3>
          <p className="text-blue-700 dark:text-blue-100 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {/* 🔹 Investment Summary + Strategy */}
      <InvestmentSummary property={property} />
      <ExitStrategyGenerator
        title={property.title}
        location={property.location}
        price={property.price}
        yield_percent={property.yield_percent}
        roi_percent={property.roi_percent}
        propertyType={property.propertyType}
        investmentType={property.investmentType}
      />

      {/* 🔹 Calculators */}
      <MortgageCalculator price={property.price} />
      <StampDutyCalculator price={property.price} />

      {/* 🔹 Area Info */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">📍 Area Intelligence</h3>
        <p className="text-gray-600 dark:text-gray-300">
          Avg. rental yield: 5.2% | Crime rate: Low | Transport: Good | Schools: Rated Good+
        </p>
      </div>

      {/* 🔹 Notes Field */}
      <NotesFields propertyId={id} />

      {/* 🔹 Deal Summary */}
      <div className="mt-10 border-t pt-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">📊 Deal Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <p className="font-semibold">Price</p>
            <p>£{property.price ? property.price.toLocaleString() : 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold">Yield</p>
            <p>{property.yield_percent ? property.yield_percent : 'N/A'}%</p>
          </div>
          <div>
            <p className="font-semibold">ROI</p>
            <p>{property.roi_percent ? property.roi_percent : 'N/A'}%</p>
          </div>
          <div>
            <p className="font-semibold">Strategy</p>
            <p>{property.investmentType ? property.investmentType : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* 🔹 Map View */}
      <div className="mt-8">
        <MapView properties={[property]} />
      </div>

      {/* 🔹 AI Assistant */}
      <AIChatbot />
    </div>
  );
};

export default PropertyDetailsPage;